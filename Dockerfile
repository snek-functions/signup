# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 as base

LABEL description="This container serves as an entry point for our future Snek Function projects."
LABEL org.opencontainers.image.source="https://github.com/cronitio/pylon-template"
LABEL maintainer="opensource@netsnek.com"

WORKDIR /usr/src/pylon

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
ARG NODE_VERSION=20
RUN apt update \
    && apt install -y curl
RUN curl -L https://raw.githubusercontent.com/tj/n/master/bin/n -o n \
    && bash n $NODE_VERSION \
    && rm n \
    && npm install -g n

RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
COPY prisma /temp/dev/prisma

RUN cd /temp/dev && bun install --frozen-lockfile
RUN cd /temp/dev && bun prisma generate

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
COPY prisma /temp/prod/prisma

RUN cd /temp/prod && bun install --frozen-lockfile --production
RUN cd /temp/prod && bun prisma generate

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM install AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ENV NODE_ENV=production

# Create .pylon folder (mkdir)
RUN mkdir .pylon
# RUN bun test
RUN bun run pylon build

# copy production dependencies and asource code into final image
FROM base AS release
RUN apt-get update -y && apt-get install -y openssl
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/pylon/.pylon .pylon
COPY --from=prerelease /usr/src/pylon/package.json .
COPY --from=prerelease /usr/src/pylon/prisma prisma

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "./node_modules/.bin/pylon-server" ]

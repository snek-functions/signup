// services/user.service.ts
import { getContext, requireAuth } from "@cronitio/pylon";
import validator from "validator";
import { InvalidInputError } from "./errors/general.errors";
import { EmailOrUsernameAlreadyExistsError, UserNotFoundError } from "./errors/user.errors";

export class UserService {
  @requireAuth()
  static async user() {
    const auth = getContext().get("auth");

    if (!auth.sub) {
      throw new UserNotFoundError("Anonymous");
    }

    return auth.sub
  }
  
  static async getIsUnique(loginName: string): Promise<any> {
    const apiKey = process.env.ORG_USER_MANAGER_TOKEN ?? 'API_KEY';
    let url = "";

    try {
      if (validator.isEmail(loginName) === true) {
        url = `${process.env.AUTH_ISSUER}/management/v1/users/_is_unique?email=${loginName}`;

      } else {
        if (validator.isAlphanumeric(loginName) === true) {
          url = `${process.env.AUTH_ISSUER}/management/v1/users/_is_unique?userName=${loginName}`;
        }
      }

      if (!url) {
        throw new InvalidInputError("Invalid email/username format");
      }

      const response: Response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const data = await response.json() as any;

      if (!response.ok) {
        return null;
      }

      return data?.isUnique ? true : false;

    } catch (e) {
      console.error(e);
      handleUserServiceError(e);
      throw e;
    }
  }

  static async userCreate(
    values: {
      emailAddress: string;
      username: string;
      password?: string;
      hashedPassword?: string;
      details?: {
        firstName?: string;
        lastName?: string;
      };
    },
    organizationId?: string,
    createProfile?: boolean,
    skipEmailVerification?: boolean
  ): Promise<any> {
    //const auth = getContext().get("auth");
    const emailAddress = values.emailAddress.toLowerCase();
    const username = values.username.toLowerCase();

    let isActive: boolean;

    if (skipEmailVerification) {
      // If skipEmailVerification is true, then we need to check if the user is an admin on the resource
      //await requireAdmin(context, [organizationId]);

      // If skipEmailVerification is true, then the user is active

      isActive = true;
    } else {
      // If skipEmailVerification is false, then the user is inactive until they verify their email
      isActive = false;
    }

    // Create the user
    const url = `${process.env.AUTH_ISSUER}/management/v1/users/human/_import`;
    const apiKey = process.env.ORG_USER_MANAGER_TOKEN ?? 'API_KEY';

    try {
      if (!await UserService.getIsUnique(username) || !await UserService.getIsUnique(emailAddress)) {
        throw new EmailOrUsernameAlreadyExistsError(
          `${username} <${emailAddress}>`
        )
      }

      const response: Response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(organizationId ? { 'x-zitadel-orgid': organizationId } : {}),
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          userName: values.username,
          profile: {
            firstName: values.details?.firstName ?? '',
            lastName: values.details?.lastName ?? '',
            preferredLanguage: 'en',
          },
          ...(values.hashedPassword ? { hashedPassword: { value: values.hashedPassword } } : {}),
          email: {
            email: values.emailAddress,
            isEmailVerified: false,
          },
          ...(values.password
            ? {
                password: values.password,
                passwordChangeRequired: false,
              }
            : {}),
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new InvalidInputError(data?.message || "Something has gone Wrong")
      }

      return data

      // if (!skipEmailVerification) {
      //   await User.createUserSendOTP(user.id);
      // }

      // try {
      //   await Login.deployAuthentication();
      // } catch (e) {
      //   console.error(e);
      // }

      //return new User(context, user);
    } catch (e) {
      console.error(e);
      handleUserServiceError(e);
      throw e;
    }
  }
}

function handleUserServiceError(e: unknown) {
  // if (e instanceof Prisma.Prisma.PrismaClientKnownRequestError) {
  //   if (e.code === "P2002") {
  //     throw new EmailOrUsernameAlreadyExistsError();
  //   } else if (e.code === "P2003") {
  //     throw new ResourceNotFoundError();
  //   } else {
  //     throw e;
  //   }
  // } else if (e instanceof EmailOrUsernameAlreadyExistsError) {
  //   throw e;
  // } else {
  //   throw e;
  // }
  throw e;
}
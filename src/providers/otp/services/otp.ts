import { AuthenticationInput, AuthIdentityProviderService, AuthenticationResponse, ICacheService, Logger, AuthIdentityDTO } from "@medusajs/framework/types"
import { AbstractAuthModuleProvider, ContainerRegistrationKeys, isDefined, MedusaError, Modules } from "@medusajs/framework/utils"

type InjectedDependencies = {
  [Modules.CACHE]: ICacheService
  [ContainerRegistrationKeys.LOGGER]: Logger
}

export const OTP_RETURN_KEY = "otp_generated"

export class OtpAuthProviderService extends AbstractAuthModuleProvider {
  static identifier = "otp"

  protected cacheService_: ICacheService
  protected logger_: Logger

  constructor(container: InjectedDependencies) {
    super()
    this.cacheService_ = container[Modules.CACHE]
    this.logger_ = container[ContainerRegistrationKeys.LOGGER]
  }

  async authenticate(): Promise<AuthenticationResponse> {
    throw new Error("To authenticate with OTP provider, you need to use the `verify` and `generate` API routes.")
  }

  async register(
    data: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    if (!isDefined(data.body?.identifier)) {
      return {
        success: false,
        error: "Identifier is required"
      }
    }

    let authIdentity: AuthIdentityDTO | undefined
    try {
      authIdentity = await authIdentityProviderService.retrieve({
        entity_id: data.body!.identifier,
      })
    } catch (error: unknown) {
      if (!(error instanceof MedusaError)) return { success: false, error: JSON.stringify(error) }

      if (error.type !== MedusaError.Types.NOT_FOUND) return { success: false, error: error.message }

      // If the identity is not found, we create it
      authIdentity = await authIdentityProviderService.create({
        entity_id: data.body!.identifier
      })
    }

    if (!authIdentity) {
      return {
        success: false,
        error: "Failed to create identity"
      }
    }

    return {
      success: true,
      authIdentity
    }
  }
}

export default OtpAuthProviderService
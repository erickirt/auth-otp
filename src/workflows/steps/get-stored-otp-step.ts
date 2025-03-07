import { ICacheService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

/**
 * Gets a stored OTP for a given auth identity ID and identifier.
 *
 * @param input - The input for the step.
 * @param input.authIdentityId - The ID of the auth identity to get the OTP for.
 * @param input.identifier - The identifier of the actor to get the OTP for.
 */
export const getStoredOtpStep = createStep(
  "get-stored-otp",
  async (input: {
    authIdentityId: string
    identifier: string,
  }, { container }) => {
    const cacheService = container.resolve<ICacheService>(Modules.CACHE)
    const storedOtp = await cacheService.get<string>(`totp:${input.authIdentityId}`)

    if (!storedOtp) {
      throw new Error("OTP not found")
    }

    return new StepResponse({ storedOtp })
  }
)
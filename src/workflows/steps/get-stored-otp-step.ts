import { ICacheService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

/**
 * Gets a stored OTP for a given key.
 *
 * @param input - The input for the step.
 * @param input.key - The key to get the OTP for.
 */
export const getStoredOtpStep = createStep(
  "get-stored-otp",
  async (input: {
    key: string
  }, { container }) => {
    const cacheService = container.resolve<ICacheService>(Modules.CACHE)
    const storedOtp = await cacheService.get<string>(`totp:${input.key}`)

    if (!storedOtp) {
      throw new Error("OTP not found")
    }

    return new StepResponse({ storedOtp })
  }
)
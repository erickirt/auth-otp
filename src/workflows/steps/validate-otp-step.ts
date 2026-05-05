import { timingSafeEqual } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export const validateOtpStep = createStep(
	"validate-otp",
	async (input: { storedOtp: string | undefined; otp: string }) => {
		if (!input.storedOtp) {
			throw new MedusaError(MedusaError.Types.NOT_FOUND, "OTP not found")
		}

		const a = Buffer.from(input.storedOtp)
		const b = Buffer.from(input.otp)

		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid OTP")
		}

		return new StepResponse({})
	},
)

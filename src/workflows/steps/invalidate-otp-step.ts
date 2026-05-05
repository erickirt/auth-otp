import type { ICacheService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export const invalidateOtpStep = createStep(
	"invalidate-otp",
	async (input: { key: string; tag?: string }, { container }) => {
		const cacheService = container.resolve<ICacheService>(Modules.CACHE)
		const key = input.tag ? `${input.tag}:${input.key}` : input.key
		await cacheService.invalidate(`otp:${key}`)
		return new StepResponse({})
	},
)

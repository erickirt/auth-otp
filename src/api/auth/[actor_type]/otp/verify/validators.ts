import { z } from "@medusajs/framework/zod"

export const PostAuthActorTypeOtpVerifySchema = z.object({
	identifier: z
		.string()
		.min(1)
		.max(255)
		.transform((s) => s.toLowerCase().trim()),
	otp: z.string().min(1),
})

export type PostAuthActorTypeOtpVerifySchema = z.infer<
	typeof PostAuthActorTypeOtpVerifySchema
>

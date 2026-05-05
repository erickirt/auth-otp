import { z } from "@medusajs/framework/zod"

export const PostAuthActorTypeOtpPreRegisterSchema = z.object({
	identifier: z
		.string()
		.min(1)
		.max(255)
		.transform((s) => s.toLowerCase().trim()),
})

export type PostAuthActorTypeOtpPreRegisterSchema = z.infer<
	typeof PostAuthActorTypeOtpPreRegisterSchema
>

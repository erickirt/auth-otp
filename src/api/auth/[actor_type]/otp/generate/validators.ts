import { z } from "@medusajs/framework/zod"

export const PostAuthActorTypeOtpGenerateSchema = z.object({
	identifier: z
		.string()
		.min(1)
		.max(255)
		.transform((s) => s.toLowerCase().trim()),
})

export type PostAuthActorTypeOtpGenerateSchema = z.infer<
	typeof PostAuthActorTypeOtpGenerateSchema
>

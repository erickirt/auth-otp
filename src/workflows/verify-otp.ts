import {
	createWorkflow,
	transform,
	WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import type { OtpOptions } from "../types"
import { getActorStep } from "./steps/get-actor-step"
import { getAuthIdentityStep } from "./steps/get-auth-identity-step"
import { getStoredOtpStep } from "./steps/get-stored-otp-step"
import { invalidateOtpStep } from "./steps/invalidate-otp-step"
import { validateOtpStep } from "./steps/validate-otp-step"

const verifyOtpWorkflow = createWorkflow(
	"verify-otp",
	(input: {
		identifier: string
		otp: string
		actorType: string
		accessorsPerActor: Required<OtpOptions>["accessorsPerActor"][string]
	}) => {
		const { actor } = getActorStep({
			identifier: input.identifier,
			actorType: input.actorType,
			accessorsPerActor: input.accessorsPerActor,
		})

		const { authIdentity } = getAuthIdentityStep({
			identifier: input.identifier,
			actorType: input.actorType,
			accessorsPerActor: input.accessorsPerActor,
			foundActor: actor,
		})

		const storedOtpResult = getStoredOtpStep({
			key: authIdentity?.id,
		})

		// validateOtpStep throws on mismatch — invalidateOtpStep only runs on success
		const validatedResult = validateOtpStep({
			storedOtp: storedOtpResult?.storedOtp,
			otp: input.otp,
		})

		// Thread validatedResult through transform to enforce execution order
		const invalidateInput = transform(
			{ authIdentity, _validated: validatedResult },
			({ authIdentity }) => ({ key: authIdentity.id }),
		)

		invalidateOtpStep(invalidateInput)

		return new WorkflowResponse({
			authIdentity,
		})
	},
)

export default verifyOtpWorkflow

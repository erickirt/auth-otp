import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { getAuthIdentityStep } from "./steps/get-auth-identity-step"
import { getStoredOtpStep } from "./steps/get-stored-otp-step"
import { validateOtpStep } from "./steps/validate-otp-step"
import { getActorStep } from "./steps/get-actor-step"
import { OtpOptions } from "../types"

const verifyOtpWorkflow = createWorkflow(
  "verify-otp",
  function (input: { identifier: string, otp: string, actorType: string, accessorsPerActor: Required<OtpOptions>['accessorsPerActor'][string] }) {
    const { actor } = getActorStep({
      identifier: input.identifier,
      actorType: input.actorType,
      accessorsPerActor: input.accessorsPerActor
    })

    const { authIdentity } = getAuthIdentityStep({
      identifier: input.identifier,
      actorType: input.actorType,
      accessorsPerActor: input.accessorsPerActor,
      foundActor: actor.data[0]
    })

    const storedOtpResult = getStoredOtpStep({
      authIdentityId: authIdentity!.id,
      identifier: input.identifier
    })

    const validateOtpResult = validateOtpStep({
        storedOtp: storedOtpResult?.storedOtp,
      otp: input.otp
    })

    // If we reach this point, validation was successful
    return new WorkflowResponse({
      isValid: validateOtpResult?.isValid,
      authIdentity: authIdentity
    })
  }
)

export default verifyOtpWorkflow



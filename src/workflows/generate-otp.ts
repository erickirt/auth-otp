import { createWorkflow, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { Events, OtpOptions } from "../types"
import { getAuthIdentityStep } from "./steps/get-auth-identity-step"
import { generateOtpStep } from "./steps/generate-otp-step"
import { getActorStep } from "./steps/get-actor-step"
import { isDefined } from "@medusajs/framework/utils"

const generateOtpWorkflow = createWorkflow(
  "generate-otp",
  function (input: { identifier: string, actorType: string, accessorsPerActor: Required<OtpOptions>['accessorsPerActor'][string] }) {
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

    const generatedOtpResult = generateOtpStep({
      authIdentityId: authIdentity!.id,
      identifier: input.identifier
    })

    emitEventStep({
      eventName: Events.OTP_GENERATED,
      data: {
        identifier: input.identifier,
        otp: generatedOtpResult
      }
    })

    return new WorkflowResponse('OK')
  }
)

export default generateOtpWorkflow



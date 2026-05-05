import { randomInt } from "node:crypto"
import type { OtpOptions } from "../types"

export class OtpUtils {
	static DEFAULT_OPTIONS: OtpOptions = {
		digits: 6,
		ttl: 60 * 5,
		accessorsPerActor: {
			customer: { accessor: "email", entityIdAccessor: "email" },
			user: { accessor: "email", entityIdAccessor: "email" },
		},
		http: {
			alwaysReturnSuccess: true,
			warnOnError: true,
		},
	}

	static generateRandomOTP(digits: number): string {
		return randomInt(0, 10 ** digits).toString().padStart(digits, "0")
	}
}

export default OtpUtils

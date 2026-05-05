import type {
	IAuthModuleService,
	ICacheService,
	ICustomerModuleService,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
	testSuite: ({ api, getContainer }) => {
		let customerModuleService: ICustomerModuleService
		let cacheService: ICacheService
		let authModuleService: IAuthModuleService

		beforeAll(() => {
			customerModuleService = getContainer().resolve(Modules.CUSTOMER)
			cacheService = getContainer().resolve(Modules.CACHE)
			authModuleService = getContainer().resolve(Modules.AUTH)
		})

		// Helper to create a customer with linked auth identity
		const createCustomerWithAuth = async (
			email: string,
			firstName: string,
			lastName: string,
		) => {
			const customer = await customerModuleService.createCustomers({
				email,
				first_name: firstName,
				last_name: lastName,
			})

			const authIdentity = await authModuleService.createAuthIdentities({
				provider_identities: [
					{
						provider: "emailpass",
						entity_id: email,
					},
				],
				app_metadata: {
					customer_id: customer.id,
				},
			})

			return { customer, authIdentity }
		}

		describe("OTP Auth Routes", () => {
			describe("POST /auth/:actor_type/otp/generate", () => {
				it("returns success message for existing customer", async () => {
					const { customer, authIdentity } = await createCustomerWithAuth(
						"generate-test@example.com",
						"Test",
						"Customer",
					)

					const response = await api.post("/auth/customer/otp/generate", {
						identifier: customer.email,
					})

					expect(response.status).toEqual(200)
					expect(response.data).toHaveProperty("message")

					// Verify OTP was stored in cache
					const cachedOtp = await cacheService.get(`otp:${authIdentity.id}`)
					expect(cachedOtp).toBeDefined()
					expect(cachedOtp).toHaveLength(6)

					// Cleanup
					await customerModuleService.deleteCustomers(customer.id)
					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})

				it("returns success even for non-existent customer (prevents enumeration)", async () => {
					const response = await api.post("/auth/customer/otp/generate", {
						identifier: "nonexistent@example.com",
					})

					// Default behavior: alwaysReturnSuccess=true prevents user enumeration
					expect(response.status).toEqual(200)
					expect(response.data).toHaveProperty("message")
				})

				it("fails with missing identifier", async () => {
					const response = await api
						.post("/auth/customer/otp/generate", {})
						.catch((e) => e.response)

					expect(response.status).toEqual(400)
				})
			})

			describe("POST /auth/:actor_type/otp/verify", () => {
				it("returns token for valid OTP", async () => {
					const { customer, authIdentity } = await createCustomerWithAuth(
						"verify-test@example.com",
						"Verify",
						"Test",
					)

					// Manually set OTP in cache (simulating generate step)
					const testOtp = "123456"
					await cacheService.set(`otp:${authIdentity.id}`, testOtp, 300)

					const response = await api.post("/auth/customer/otp/verify", {
						identifier: customer.email,
						otp: testOtp,
					})

					expect(response.status).toEqual(200)
					expect(response.data).toHaveProperty("token")
					expect(typeof response.data.token).toBe("string")

					// Cleanup
					await customerModuleService.deleteCustomers(customer.id)
					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})

				it("fails with invalid OTP", async () => {
					const { customer, authIdentity } = await createCustomerWithAuth(
						"invalid-otp-test@example.com",
						"Invalid",
						"OTP",
					)

					await cacheService.set(`otp:${authIdentity.id}`, "123456", 300)

					const response = await api
						.post("/auth/customer/otp/verify", {
							identifier: customer.email,
							otp: "000000", // Wrong OTP
						})
						.catch((e) => e.response)

					expect(response.status).toEqual(400)
					expect(response.data.message).toContain("Invalid OTP")

					// Cleanup
					await customerModuleService.deleteCustomers(customer.id)
					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})

				it("fails with missing OTP", async () => {
					const response = await api
						.post("/auth/customer/otp/verify", {
							identifier: "test@example.com",
						})
						.catch((e) => e.response)

					expect(response.status).toEqual(400)
				})

				it("fails with missing identifier", async () => {
					const response = await api
						.post("/auth/customer/otp/verify", {
							otp: "123456",
						})
						.catch((e) => e.response)

					expect(response.status).toEqual(400)
				})
			})

			describe("POST /auth/:actor_type/otp/pre-register", () => {
				it("generates OTP for new identifier (no existing customer)", async () => {
					const newEmail = "new-user@example.com"

					const response = await api.post("/auth/customer/otp/pre-register", {
						identifier: newEmail,
					})

					expect(response.status).toEqual(200)
					expect(response.data).toHaveProperty("message")

					// Verify OTP was stored with pre-register tag
					const cachedOtp = await cacheService.get(
						`otp:pre-register:${newEmail}`,
					)
					expect(cachedOtp).toBeDefined()
					expect(cachedOtp).toHaveLength(6)
				})

				it("returns success when customer already exists (prevents enumeration)", async () => {
					const { customer, authIdentity } = await createCustomerWithAuth(
						"existing-preregister@example.com",
						"Existing",
						"Customer",
					)

					const response = await api.post("/auth/customer/otp/pre-register", {
						identifier: customer.email,
					})

					// Default behavior: alwaysReturnSuccess=true prevents user enumeration
					expect(response.status).toEqual(200)
					expect(response.data).toHaveProperty("message")

					// Cleanup
					await customerModuleService.deleteCustomers(customer.id)
					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})

				it("fails with missing identifier", async () => {
					const response = await api
						.post("/auth/customer/otp/pre-register", {})
						.catch((e) => e.response)

					expect(response.status).toEqual(400)
				})
			})

			describe("Full OTP flow", () => {
				it("completes generate -> verify flow for existing customer", async () => {
					const { customer, authIdentity } = await createCustomerWithAuth(
						"full-flow@example.com",
						"Full",
						"Flow",
					)

					// Step 1: Generate OTP
					const generateResponse = await api.post(
						"/auth/customer/otp/generate",
						{
							identifier: customer.email,
						},
					)
					expect(generateResponse.status).toEqual(200)

					// Get the OTP from cache
					const otp = await cacheService.get(`otp:${authIdentity.id}`)
					expect(otp).toBeDefined()

					// Step 2: Verify OTP
					const verifyResponse = await api.post("/auth/customer/otp/verify", {
						identifier: customer.email,
						otp: otp as string,
					})

					expect(verifyResponse.status).toEqual(200)
					expect(verifyResponse.data).toHaveProperty("token")

					// Cleanup
					await customerModuleService.deleteCustomers(customer.id)
					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})
			})

			describe("Security", () => {
				// H2 — identifier is case-insensitive end-to-end
				it("H2: generate with uppercase email, verify with lowercase succeeds", async () => {
					const lowerEmail = "h2-casetest@example.com"
					const { customer, authIdentity } = await createCustomerWithAuth(
						lowerEmail,
						"H2",
						"Test",
					)

					const generateResponse = await api.post(
						"/auth/customer/otp/generate",
						{ identifier: lowerEmail.toUpperCase() },
					)
					expect(generateResponse.status).toEqual(200)

					const otp = await cacheService.get(`otp:${authIdentity.id}`)
					expect(otp).toBeDefined()

					const verifyResponse = await api.post("/auth/customer/otp/verify", {
						identifier: lowerEmail,
						otp: otp as string,
					})
					expect(verifyResponse.status).toEqual(200)
					expect(verifyResponse.data).toHaveProperty("token")

					await customerModuleService.deleteCustomers(customer.id)
					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})

				// H3 — unknown actor type returns 400, not a crash
				it("H3: unknown actor type returns 400", async () => {
					const gen = await api
						.post("/auth/unknownactor/otp/generate", {
							identifier: "a@b.com",
						})
						.catch((e) => e.response)
					expect(gen.status).toEqual(400)

					const ver = await api
						.post("/auth/unknownactor/otp/verify", {
							identifier: "a@b.com",
							otp: "123456",
						})
						.catch((e) => e.response)
					expect(ver.status).toEqual(400)

					const pre = await api
						.post("/auth/unknownactor/otp/pre-register", {
							identifier: "a@b.com",
						})
						.catch((e) => e.response)
					expect(pre.status).toEqual(400)
				})

				// C2 — OTP is single-use after successful verify
				it("C2: OTP cannot be reused after successful verify", async () => {
					const { customer, authIdentity } = await createCustomerWithAuth(
						"c2-single-use@example.com",
						"C2",
						"Test",
					)

					const testOtp = "555555"
					await cacheService.set(`otp:${authIdentity.id}`, testOtp, 300)

					const first = await api.post("/auth/customer/otp/verify", {
						identifier: customer.email,
						otp: testOtp,
					})
					expect(first.status).toEqual(200)
					expect(first.data).toHaveProperty("token")

					const second = await api
						.post("/auth/customer/otp/verify", {
							identifier: customer.email,
							otp: testOtp,
						})
						.catch((e) => e.response)
					expect(second.status).toEqual(400)

					await customerModuleService.deleteCustomers(customer.id)
					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})

				// H1 — pre-register OTP is single-use after register
				it("H1: pre-register OTP cannot be reused after register", async () => {
					const identifier = "h1-preregsingle@example.com"

					await api.post("/auth/customer/otp/pre-register", { identifier })
					const otp = await cacheService.get(
						`otp:pre-register:${identifier}`,
					)
					expect(otp).toBeDefined()

					await api.post("/auth/customer/otp/register", { identifier, otp })

					const consumed = await cacheService.get(
						`otp:pre-register:${identifier}`,
					)
					expect(consumed).toBeNull()

					const second = await api
						.post("/auth/customer/otp/register", { identifier, otp })
						.catch((e) => e.response)
					expect(second.status).not.toEqual(200)
				})

				// C3 — recently_registered bypass is single-use (invalidation key was wrong before)
				it("C3: recently_registered bypass is consumed after first authenticate", async () => {
					const identifier = "c3-recent-reg@example.com"
					const otp = "777777"

					const authIdentity = await authModuleService.createAuthIdentities({
						provider_identities: [{ provider: "otp", entity_id: identifier }],
						app_metadata: {},
					})

					// Simulate what register() does: set the recently_registered cache key
					await cacheService.set(
						`recently_registered:${identifier}:${otp}`,
						"true",
						60,
					)

					// First authenticate via Medusa standard path — should succeed via bypass
					const first = await api.post(`/auth/customer/otp`, {
						identifier,
						otp,
					})
					expect(first.status).toEqual(200)

					// Key must be gone after first use
					const gone = await cacheService.get(
						`recently_registered:${identifier}:${otp}`,
					)
					expect(gone).toBeNull()

					// Second attempt — bypass consumed, falls through to OTP check which also fails
					const second = await api
						.post(`/auth/customer/otp`, { identifier, otp })
						.catch((e) => e.response)
					expect(second.status).not.toEqual(200)

					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})

				// H4 — timing-safe OTP comparison: correct, wrong same length, wrong different length
				it("H4: OTP comparison rejects wrong and different-length OTPs", async () => {
					const { customer, authIdentity } = await createCustomerWithAuth(
						"h4-timingsafe@example.com",
						"H4",
						"Test",
					)

					const correctOtp = "123456"

					// correct OTP succeeds
					await cacheService.set(`otp:${authIdentity.id}`, correctOtp, 300)
					const valid = await api.post("/auth/customer/otp/verify", {
						identifier: customer.email,
						otp: correctOtp,
					})
					expect(valid.status).toEqual(200)

					// wrong OTP same length fails
					await cacheService.set(`otp:${authIdentity.id}`, correctOtp, 300)
					const wrongSameLen = await api
						.post("/auth/customer/otp/verify", {
							identifier: customer.email,
							otp: "999999",
						})
						.catch((e) => e.response)
					expect(wrongSameLen.status).toEqual(400)

					// OTP shorter than stored fails
					await cacheService.set(`otp:${authIdentity.id}`, correctOtp, 300)
					const tooShort = await api
						.post("/auth/customer/otp/verify", {
							identifier: customer.email,
							otp: "12345",
						})
						.catch((e) => e.response)
					expect(tooShort.status).toEqual(400)

					// OTP longer than stored fails
					await cacheService.set(`otp:${authIdentity.id}`, correctOtp, 300)
					const tooLong = await api
						.post("/auth/customer/otp/verify", {
							identifier: customer.email,
							otp: "1234567",
						})
						.catch((e) => e.response)
					expect(tooLong.status).toEqual(400)

					await customerModuleService.deleteCustomers(customer.id)
					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})

				// M3 — OTP generation produces numeric-only string of correct length
				it("M3: generated OTP is numeric and matches configured digit count", async () => {
					const { customer, authIdentity } = await createCustomerWithAuth(
						"m3-otp-format@example.com",
						"M3",
						"Test",
					)

					await api.post("/auth/customer/otp/generate", {
						identifier: customer.email,
					})

					const otp = await cacheService.get(`otp:${authIdentity.id}`) as string
					expect(otp).toBeDefined()
					expect(otp).toMatch(/^\d{6}$/)
					expect(Number(otp)).toBeGreaterThanOrEqual(0)
					expect(Number(otp)).toBeLessThan(1_000_000)

					await customerModuleService.deleteCustomers(customer.id)
					await authModuleService.deleteAuthIdentities([authIdentity.id])
				})

				// C1 — actor not found does not leak auth identities via MikroORM undefined filter
				it("C1: ghost identifier returns generic success, no data leaked", async () => {
					const beforeCount = (await authModuleService.listAuthIdentities())
						.length

					const response = await api.post("/auth/customer/otp/generate", {
						identifier: "ghost-nobody@example.com",
					})

					expect(response.status).toEqual(200)
					expect(response.data).toHaveProperty("message")

					const afterCount = (await authModuleService.listAuthIdentities())
						.length
					expect(afterCount).toEqual(beforeCount)
				})
			})
		})
	},
})

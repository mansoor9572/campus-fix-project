import test from "node:test"
import assert from "node:assert/strict"
import { createMemberInput, updateMemberInput } from "../lib/team/validation"
const department = "11111111-1111-4111-8111-111111111111"
const worker = { name: "Worker One", email: "Worker@Example.com", role: "maintenance_staff", departmentId: department, password: "Temporary password 42!" }
test("worker provisioning requires a department and normalizes email", () => {
  assert.equal(createMemberInput(worker).email, "worker@example.com")
  assert.throws(() => createMemberInput({ ...worker, departmentId: null }))
  assert.throws(() => createMemberInput({ ...worker, password: "short" }))
  assert.throws(() => createMemberInput({ ...worker, role: "student" }))
  assert.throws(() => createMemberInput({ ...worker, isActive: true }))
})
test("administrators are created explicitly without worker membership", () => {
  const admin = { ...worker, role: "admin", departmentId: null }
  assert.equal(createMemberInput(admin).role, "admin")
  assert.throws(() => createMemberInput({ ...admin, departmentId: department }))
})
test("account changes cannot promote users, replace emails, or combine reset and deactivation", () => {
  assert.deepEqual(updateMemberInput({ isActive: false }), { kind: "active", isActive: false })
  assert.deepEqual(updateMemberInput({ departmentId: department }), { kind: "department", departmentId: department })
  for (const input of [{ role: "admin" }, { email: "new@example.com" }, { password: worker.password, isActive: false }, {}, { isActive: "false" }]) assert.throws(() => updateMemberInput(input))
})

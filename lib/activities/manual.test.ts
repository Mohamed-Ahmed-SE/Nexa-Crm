import { describe, expect, it } from "vitest";
import { canModifyManualActivity, isManualActivityType } from "./manual";

const manual = { is_system_event: false, activity_type: "call", created_by: "user-1" };

describe("manual activity helpers", () => {
  it.each(["call", "email", "meeting", "note"])("treats %s as a manual type", (type) => expect(isManualActivityType(type)).toBe(true));
  it.each(["record_created", "owner_changed", "status_changed", "stage_changed", "task_completed", "", "Call"])("treats %j as system-generated", (type) => expect(isManualActivityType(type)).toBe(false));

  it("lets the creator modify their manual activity", () => {
    expect(canModifyManualActivity({ isAdmin: false, userId: "user-1", activity: manual })).toBe(true);
  });

  it("lets an admin modify a manual activity created by someone else", () => {
    expect(canModifyManualActivity({ isAdmin: true, userId: "admin-1", activity: manual })).toBe(true);
  });

  it("does not let a non-admin modify someone else’s activity", () => {
    expect(canModifyManualActivity({ isAdmin: false, userId: "user-2", activity: manual })).toBe(false);
  });

  it("never allows system events or system-generated types, even for admins or the creator", () => {
    expect(canModifyManualActivity({ isAdmin: true, userId: "user-1", activity: { ...manual, is_system_event: true } })).toBe(false);
    expect(canModifyManualActivity({ isAdmin: true, userId: "user-1", activity: { ...manual, activity_type: "owner_changed" } })).toBe(false);
    expect(canModifyManualActivity({ isAdmin: false, userId: "user-1", activity: { ...manual, activity_type: "stage_changed" } })).toBe(false);
  });
});

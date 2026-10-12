"use client";

import { useActionState, useEffect, useState } from "react";
import { switchWorkspaceAction } from "@/lib/auth/workspace-actions";
import type { WorkspaceContext } from "@/lib/auth/context";

type WorkspaceSwitcherProps = {
  context: WorkspaceContext;
};

export function WorkspaceSwitcher({ context }: WorkspaceSwitcherProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(context.workspaceId);
  const [state, formAction] = useActionState(switchWorkspaceAction, { error: null });

  useEffect(() => {
    if (state.error) setSelectedWorkspaceId(context.workspaceId);
  }, [context.workspaceId, state]);

  return (
    <div className="workspace-switcher">
      <form action={formAction} className="workspace-switcher-form">
        <label className="workspace-switcher-label" htmlFor="workspace-selection">Workspace</label>
        <select
          aria-label="Switch workspace"
          className="workspace-switcher-select"
          onChange={(event) => setSelectedWorkspaceId(event.currentTarget.value)}
          value={selectedWorkspaceId}
          id="workspace-selection"
          name="workspaceId"
        >
          {context.workspaces.map(({ id, name }) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <button className="workspace-switcher-submit" type="submit">Switch</button>
      </form>
      {state.error ? <p className="workspace-switcher-error" role="alert">{state.error}</p> : null}
      <span className="workspace-switcher-user">{context.fullName} · {context.role}</span>
    </div>
  );
}

"use client";

import { useActionState, useRef, useState } from "react";
import { createWorkspaceAction } from "@/lib/auth/actions";
import { initialFormState, type PipelineTemplate } from "@/lib/auth/validation";
import styles from "./onboarding-form.module.css";

const STEPS = ["Welcome", "Workspace name", "User role/job title", "Choose pipeline template"] as const;

export function OnboardingForm() {
  const [state, action, isPending] = useActionState(createWorkspaceAction, initialFormState);
  const [step, setStep] = useState(0);
  const [workspaceName, setWorkspaceName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [pipelineTemplate, setPipelineTemplate] = useState<PipelineTemplate>("standard_sales");
  const formRef = useRef<HTMLFormElement>(null);
  const templateRef = useRef<HTMLInputElement>(null);

  function advanceStep() {
    if (formRef.current?.reportValidity()) setStep((currentStep) => Math.min(currentStep + 1, STEPS.length - 1));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (step === STEPS.length - 1) return;
    event.preventDefault();
    advanceStep();
  }

  function skipTemplate() {
    setPipelineTemplate("standard_sales");
    if (templateRef.current) templateRef.current.value = "standard_sales";
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <ol aria-label="Onboarding progress" className={styles.progress}>
        {STEPS.map((label, index) => (
          <li aria-current={index === step ? "step" : undefined} className={index === step ? styles.currentStep : undefined} key={label}>
            <span>{index + 1}</span>{label}
          </li>
        ))}
      </ol>
      <form action={step === STEPS.length - 1 ? action : undefined} className="auth-form" onSubmit={handleSubmit} ref={formRef}>
        {step === 0 ? (
          <div className={styles.welcome}>
            <h2>Welcome to Nexa CRM</h2>
            <p>Keep customer relationships and follow-ups in one structured place.</p>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="auth-field">
            <label htmlFor="workspaceName">Workspace name <span aria-hidden="true">*</span></label>
            <input autoComplete="organization" id="workspaceName" maxLength={80} minLength={2} onChange={(event) => setWorkspaceName(event.target.value)} required value={workspaceName} />
            <span className="auth-hint">Use your company or team name.</span>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="auth-field">
            <label htmlFor="jobTitle">Your role or job title <span className="optional-label">Optional</span></label>
            <input autoComplete="organization-title" id="jobTitle" maxLength={100} onChange={(event) => setJobTitle(event.target.value)} value={jobTitle} />
            <span className="auth-hint">This helps tailor your workspace to your role.</span>
          </div>
        ) : null}
        {step === 3 ? (
          <fieldset className={styles.templateChoices}>
            <legend>Choose a starting pipeline</legend>
            <label className={styles.templateChoice}>
              <input checked={pipelineTemplate === "standard_sales"} name="pipelineTemplateChoice" onChange={() => setPipelineTemplate("standard_sales")} type="radio" />
              <span><strong>Standard Sales <span className={styles.recommended}>Recommended</span></strong><span>Discovery, Qualified, Proposal, Negotiation, Won, Lost</span></span>
            </label>
            <label className={styles.templateChoice}>
              <input checked={pipelineTemplate === "simple_sales"} name="pipelineTemplateChoice" onChange={() => setPipelineTemplate("simple_sales")} type="radio" />
              <span><strong>Simple Sales</strong><span>Qualified, Proposal, Won, Lost</span></span>
            </label>
          </fieldset>
        ) : null}
        {step === STEPS.length - 1 ? (
          <>
            <input name="workspaceName" type="hidden" value={workspaceName} />
            <input name="jobTitle" type="hidden" value={jobTitle} />
            <input name="pipelineTemplate" ref={templateRef} type="hidden" value={pipelineTemplate} />
          </>
        ) : null}
        {state.message ? <p aria-live="polite" className="auth-message" role="status">{state.message}</p> : null}
        <div className={styles.actions}>
          {step > 0 ? <button className={styles.backButton} onClick={() => setStep((currentStep) => currentStep - 1)} type="button">Back</button> : null}
          {step < STEPS.length - 1 ? (
            <button className="auth-submit" onClick={advanceStep} type="button">Continue</button>
          ) : (
            <button className="auth-submit" disabled={isPending} type="submit">{isPending ? "Creating workspace…" : "Create workspace"}</button>
          )}
        </div>
        {step === STEPS.length - 1 ? <button className={styles.skipButton} disabled={isPending} onClick={skipTemplate} type="button">Skip for now</button> : null}
      </form>
    </>
  );
}

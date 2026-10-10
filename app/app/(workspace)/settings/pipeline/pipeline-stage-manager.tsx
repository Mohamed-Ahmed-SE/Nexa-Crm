"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPipelineStageAction, deactivatePipelineStageAction, renamePipelineStageAction, reorderPipelineStagesAction, updatePipelineStageProbabilityAction, type PipelineStageActionState } from "./actions";
import styles from "./pipeline-stage-manager.module.css";

export type WorkspacePipeline = { id: string; name: string };
export type WorkspacePipelineStage = { id: string; pipeline_id: string; name: string; position: number; probability: number; stage_type: string; is_active: boolean };

const emptyActionState: PipelineStageActionState = {};

function AddStageForm({ pipeline }: { pipeline: WorkspacePipeline }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createPipelineStageAction, emptyActionState);
  const nameError = state.fieldErrors?.name?.[0];
  const probabilityError = state.fieldErrors?.probability?.[0];

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state]);

  return (
    <form action={formAction} className={styles.createForm}>
      <input name="pipelineId" type="hidden" value={pipeline.id} />
      <label className={`${styles.field} ${styles.createField}`}>
        <span>New stage name for {pipeline.name}</span>
        <input aria-describedby={nameError ? `pipeline-${pipeline.id}-name-error` : undefined} aria-invalid={Boolean(nameError)} maxLength={100} name="name" required />
        {nameError && <small className={styles.error} id={`pipeline-${pipeline.id}-name-error`}>{nameError}</small>}
      </label>
      <label className={`${styles.probabilityField} ${styles.createField}`}>
        <span>Default probability for new stage in {pipeline.name}</span>
        <span className={styles.probabilityInput}>
          <input aria-describedby={probabilityError ? `pipeline-${pipeline.id}-probability-error` : undefined} aria-invalid={Boolean(probabilityError)} max={100} min={0} name="probability" required step={1} type="number" />
          <span aria-hidden="true">%</span>
        </span>
        {probabilityError && <small className={styles.error} id={`pipeline-${pipeline.id}-probability-error`}>{probabilityError}</small>}
      </label>
      <button className={`${styles.button} ${styles.primary}`} disabled={pending} type="submit">{pending ? "Adding stage…" : "Add stage"}</button>
      {state.message && <p aria-live="polite" className={`${styles.feedback} ${state.ok ? styles.success : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
    </form>
  );
}

function StageNameForm({ stage }: { stage: WorkspacePipelineStage }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(renamePipelineStageAction, emptyActionState);
  const nameError = state.fieldErrors?.name?.[0];

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state]);

  return (
    <form action={formAction} className={styles.renameForm}>
      <input name="stageId" type="hidden" value={stage.id} />
      <label className={styles.field}>
        <span className="sr-only">Rename {stage.name}</span>
        <input aria-describedby={nameError ? `stage-${stage.id}-error` : undefined} aria-invalid={Boolean(nameError)} defaultValue={stage.name} maxLength={100} name="name" required />
        {nameError && <small className={styles.error} id={`stage-${stage.id}-error`}>{nameError}</small>}
      </label>
      <button className={styles.button} disabled={pending} type="submit">{pending ? "Saving…" : "Save name"}</button>
      {state.message && <span aria-live="polite" className={`${styles.feedback} ${state.ok ? styles.success : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</span>}
    </form>
  );
}

function StageProbabilityForm({ stage }: { stage: WorkspacePipelineStage }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updatePipelineStageProbabilityAction, emptyActionState);
  const [probability, setProbability] = useState(String(stage.probability));
  const probabilityError = state.fieldErrors?.probability?.[0];

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state]);

  useEffect(() => {
    setProbability(String(stage.probability));
  }, [stage.probability]);

  return (
    <form action={formAction} className={styles.probabilityForm}>
      <input name="stageId" type="hidden" value={stage.id} />
      <label className={styles.probabilityField}>
        <span>Default probability for {stage.name}</span>
        <span className={styles.probabilityInput}>
          <input aria-describedby={probabilityError ? `stage-${stage.id}-probability-error` : undefined} aria-invalid={Boolean(probabilityError)} max={100} min={0} name="probability" onChange={(event) => setProbability(event.currentTarget.value)} required step={1} type="number" value={probability} />
          <span aria-hidden="true">%</span>
        </span>
        {probabilityError && <small className={styles.error} id={`stage-${stage.id}-probability-error`}>{probabilityError}</small>}
      </label>
      <button className={styles.button} disabled={pending} type="submit">{pending ? "Saving…" : "Save probability"}</button>
      {state.message && <span aria-live="polite" className={`${styles.feedback} ${state.ok ? styles.success : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</span>}
    </form>
  );
}

function DisableStageForm({ stage }: { stage: WorkspacePipelineStage }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deactivatePipelineStageAction, emptyActionState);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state]);

  return (
    <form action={formAction} className={styles.disableForm}>
      <input name="stageId" type="hidden" value={stage.id} />
      <button className={styles.button} disabled={pending} type="submit">{pending ? "Disabling…" : "Disable stage"}</button>
      {state.message && <span aria-live="polite" className={`${styles.feedback} ${state.ok ? styles.success : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</span>}
    </form>
  );
}

function reconcileStageIds(currentIds: string[], activeStages: WorkspacePipelineStage[]) {
  const activeIds = activeStages.map((stage) => stage.id);
  const activeIdSet = new Set(activeIds);
  const reconciledIds = currentIds.filter((stageId) => activeIdSet.has(stageId));
  reconciledIds.push(...activeIds.filter((stageId) => !currentIds.includes(stageId)));
  if (reconciledIds.length === currentIds.length && reconciledIds.every((stageId, index) => stageId === currentIds[index])) return currentIds;
  return reconciledIds;
}

function PipelineStageList({ pipeline, stages }: { pipeline: WorkspacePipeline; stages: WorkspacePipelineStage[] }) {
  const router = useRouter();
  const movableStages = useMemo(() => stages.filter((stage) => stage.stage_type === "open" && stage.is_active), [stages]);
  const [stageIds, setStageIds] = useState(movableStages.map((stage) => stage.id));
  const orderedStageIds = reconcileStageIds(stageIds, movableStages);
  const [state, formAction, pending] = useActionState(reorderPipelineStagesAction, emptyActionState);
  const stagesById = new Map(movableStages.map((stage) => [stage.id, stage]));
  let movableIndex = 0;
  const displayedStages = stages.map((stage) => stage.stage_type === "open" && stage.is_active
    ? stagesById.get(orderedStageIds[movableIndex++]) ?? stage
    : stage);

  useEffect(() => {
    setStageIds((current) => reconcileStageIds(current, movableStages));
  }, [movableStages]);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state]);

  function moveStage(stageId: string, offset: -1 | 1) {
    setStageIds((current) => {
      const currentIds = reconcileStageIds(current, movableStages);
      const currentIndex = currentIds.indexOf(stageId);
      const destination = currentIndex + offset;
      if (destination < 0 || destination >= currentIds.length) return currentIds;
      const changed = [...currentIds];
      [changed[currentIndex], changed[destination]] = [changed[destination], changed[currentIndex]];
      return changed;
    });
  }

  return (
    <section aria-labelledby={`pipeline-${pipeline.id}`} className={styles.pipeline}>
      <h2 id={`pipeline-${pipeline.id}`}>{pipeline.name}</h2>
      {stages.length ? (
        <>
          <ol className={styles.list}>
            {displayedStages.map((stage) => {
              const movable = stage.stage_type === "open" && stage.is_active;
              const order = orderedStageIds.indexOf(stage.id);
              return (
                <li className={styles.row} key={stage.id}>
                  <div className={styles.stageDetails}>
                    <span className={styles.position}>{stage.position}</span>
                    <div><strong>{stage.name}</strong><small>{movable ? "Active stage" : stage.stage_type === "open" ? "Inactive stage" : stage.stage_type === "won" ? "Terminal · Won" : "Terminal · Lost"}</small></div>
                  </div>
                  {movable ? (
                    <>
                      <StageNameForm stage={stage} />
                      <StageProbabilityForm stage={stage} />
                      <div aria-label={`Actions for ${stage.name}`} className={styles.orderControls} role="group">
                        <button aria-label={`Move ${stage.name} up`} className={styles.button} disabled={pending || order === 0} onClick={() => moveStage(stage.id, -1)} type="button">Move up</button>
                        <button aria-label={`Move ${stage.name} down`} className={styles.button} disabled={pending || order === orderedStageIds.length - 1} onClick={() => moveStage(stage.id, 1)} type="button">Move down</button>
                        <DisableStageForm stage={stage} />
                      </div>
                    </>
                  ) : <span className={styles.locked}>Not editable</span>}
                </li>
              );
            })}
          </ol>
          {movableStages.length > 0 && (
            <form action={formAction} className={styles.reorderForm}>
              <input name="pipelineId" type="hidden" value={pipeline.id} />
              <input name="stageIds" type="hidden" value={JSON.stringify(orderedStageIds)} />
              <button className={`${styles.button} ${styles.primary}`} disabled={pending} type="submit">{pending ? "Saving order…" : "Save stage order"}</button>
              {state.message && <p aria-live="polite" className={`${styles.feedback} ${state.ok ? styles.success : ""}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
            </form>
          )}
        </>
      ) : <p className={styles.empty}>No stages are configured for this pipeline.</p>}
      <AddStageForm pipeline={pipeline} />
    </section>
  );
}

export function PipelineStageManager({ pipelines, stages }: { pipelines: WorkspacePipeline[]; stages: WorkspacePipelineStage[] }) {
  return (
    <div aria-label="Pipelines and stages" className={styles.manager}>
      {pipelines.length ? pipelines.map((pipeline) => (
        <PipelineStageList key={pipeline.id} pipeline={pipeline} stages={stages.filter((stage) => stage.pipeline_id === pipeline.id)} />
      )) : <p className={styles.empty}>No pipelines are configured for this workspace.</p>}
    </div>
  );
}

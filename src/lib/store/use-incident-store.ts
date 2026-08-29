"use client";

import {
  PRIMARY_INCIDENT_ID,
  PRIMARY_SERVICE_ID,
  ROLLBACK_VERSION,
} from "@/lib/constants";
import { telemetryEngine } from "@/lib/observability/engine";
import type {
  AgentActivity,
  AgentMessage,
  AgentStatus,
  AppState,
  Evidence,
  Hypothesis,
  IncidentStatus,
  PendingAction,
  WorkspaceTab,
} from "@/types";
import { create } from "zustand";

export interface IncidentStore extends AppState {
  setTab: (tab: WorkspaceTab) => void;
  selectIncident: (id: string) => void;
  selectTrace: (id: string | null) => void;
  selectLogTrace: (id: string | null) => void;
  setIncidentStatus: (status: IncidentStatus) => void;
  setAgentStatus: (status: AgentStatus) => void;
  setAgentMessages: (messages: AgentMessage[]) => void;
  addAgentMessage: (message: AgentMessage) => void;
  setProgressStep: (step: number) => void;
  addActivity: (activity: AgentActivity) => void;
  updateActivity: (id: string, patch: Partial<AgentActivity>) => void;
  addEvidence: (evidence: Evidence) => void;
  setHypotheses: (hypotheses: Hypothesis[]) => void;
  setPendingAction: (action: PendingAction | undefined) => void;
  approve: () => void;
  reject: () => void;
  triggerRecovery: () => void;
  resetInvestigation: () => void;
  syncTelemetryFromEngine: () => void;
}

function initialState(): AppState {
  return {
    selectedIncidentId: PRIMARY_INCIDENT_ID,
    incidentStatus: "investigating",
    workspaceTab: "overview",
    selectedTraceId: null,
    selectedLogTraceId: null,
    agent: {
      status: "idle",
      messages: [],
      activities: [],
      hypotheses: [],
      evidence: [],
      progressStep: 0,
    },
    telemetry: {
      recoveryTriggered: false,
    },
    approval: {
      approved: false,
    },
  };
}

export const useIncidentStore = create<IncidentStore>((set, get) => ({
  ...initialState(),

  setTab: (tab) => set({ workspaceTab: tab }),

  selectIncident: (id) =>
    set({
      selectedIncidentId: id,
      selectedTraceId: null,
      selectedLogTraceId: null,
    }),

  selectTrace: (id) => set({ selectedTraceId: id }),

  selectLogTrace: (id) => set({ selectedLogTraceId: id }),

  setIncidentStatus: (status) => set({ incidentStatus: status }),

  setAgentStatus: (status) =>
    set((state) => ({
      agent: { ...state.agent, status },
    })),

  setAgentMessages: (messages) =>
    set((state) => ({
      agent: { ...state.agent, messages },
    })),

  addAgentMessage: (message) =>
    set((state) => ({
      agent: { ...state.agent, messages: [...state.agent.messages, message] },
    })),

  setProgressStep: (step) =>
    set((state) => ({
      agent: { ...state.agent, progressStep: step },
    })),

  addActivity: (activity) =>
    set((state) => ({
      agent: { ...state.agent, activities: [...state.agent.activities, activity] },
    })),

  updateActivity: (id, patch) =>
    set((state) => ({
      agent: {
        ...state.agent,
        activities: state.agent.activities.map((activity) =>
          activity.id === id ? { ...activity, ...patch } : activity,
        ),
      },
    })),

  addEvidence: (evidence) =>
    set((state) => ({
      agent: { ...state.agent, evidence: [...state.agent.evidence, evidence] },
    })),

  setHypotheses: (hypotheses) =>
    set((state) => ({
      agent: { ...state.agent, hypotheses },
    })),

  setPendingAction: (action) =>
    set({
      approval: action
        ? { pendingAction: action, approved: false }
        : { approved: false },
      incidentStatus: action ? "action_pending" : get().incidentStatus,
    }),

  approve: () => {
    const pending = get().approval.pendingAction;
    if (!pending) {
      return;
    }
    set({
      approval: { pendingAction: pending, approved: true },
    });
  },

  reject: () => {
    if (!get().approval.pendingAction) {
      return;
    }
    set({
      approval: { approved: false },
      incidentStatus: "identified",
    });
  },

  triggerRecovery: () => {
    telemetryEngine.rollback({
      service: PRIMARY_SERVICE_ID,
      targetVersion: ROLLBACK_VERSION,
    });
    set({
      telemetry: { recoveryTriggered: true },
      incidentStatus: "remediating",
      approval: { approved: false },
    });
  },

  resetInvestigation: () => {
    telemetryEngine.reset();
    set({
      ...initialState(),
    });
  },

  syncTelemetryFromEngine: () =>
    set({
      telemetry: { recoveryTriggered: telemetryEngine.isRecoveryTriggered() },
    }),
}));

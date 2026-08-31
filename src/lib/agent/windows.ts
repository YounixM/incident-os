import { DEMO_NOW_ISO, ERROR_RISE_ISO } from "@/lib/constants";
import { REQUEST_RAMP_END_ISO, SERIES_START_ISO } from "@/data/story";

export const QUERY_WINDOW = {
  startTime: SERIES_START_ISO,
  endTime: DEMO_NOW_ISO,
} as const;

export const COMPARE_WINDOW = {
  baselineStart: SERIES_START_ISO,
  baselineEnd: REQUEST_RAMP_END_ISO,
  incidentStart: ERROR_RISE_ISO,
  incidentEnd: DEMO_NOW_ISO,
} as const;

import axios from "axios";
import { generateServiceAccessToken, getProjectId } from "./metadataService";

const meta = require("../package.json");

const getAxiosInstance = async () => {
  const baseURL =
    process.env.DEV === "true"
      ? "https://rowy-run-service-gkxqefhk3q-uc.a.run.app"
      : "https://rowy.run/";
  const authToken = await generateServiceAccessToken(baseURL);
  return axios.create({
    baseURL,
    timeout: 1000,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + authToken,
    },
  });
};

export const getExtension = async (
  extensionId: string
): Promise<{
  dependencies: { [key: string]: string };
  extension: string;
  syncScript?: string;
}> => {
  const axiosInstance = await getAxiosInstance();
  return (await axiosInstance.get(`extensions/${extensionId}`)).data;
};

let projectId;

export const telemetryInstance = axios.create({
  baseURL: "https://rowy.events/",
  timeout: 1000,
  headers: {
    "Content-Type": "application/json",
  },
});
export const telemetry = async (event) => {
  try {
    if (!projectId) {
      projectId = await getProjectId();
    }
    const body = {
      projectId,
      event,
      source: meta.name,
    };
    return await telemetryInstance.post(`monitor`, body);
  } catch (error: any) {
    console.warn(
      `[telemetry] Failed to send telemetry for event '${event}':`,
      error?.message || error
    );
    return null;
  }
};

export const telemetryError = async (event, error) => {
  try {
    if (!projectId) {
      projectId = await getProjectId();
    }
    const body = {
      projectId,
      event,
      source: meta.name,
      error: JSON.stringify(error),
    };
    console.log("error", body);
    return await telemetryInstance.post(`error`, body);
  } catch (telemetryErr: any) {
    console.warn(
      `[telemetryError] Failed to send error telemetry for event '${event}':`,
      telemetryErr?.message || telemetryErr
    );
    return null;
  }
};

export const telemetryRuntimeDependencyPerformance = async ({
  functionStartTime,
  functionEndTime,
  yarnStartTime,
  yarnFinishTime,
  dependenciesString,
}) => {
  try {
    if (!projectId) {
      projectId = await getProjectId();
    }
    const body = {
      projectId,
      source: meta.name,
      functionStartTime,
      functionEndTime,
      yarnStartTime,
      yarnFinishTime,
      dependenciesString,
    };
    return await telemetryInstance.post(`runtime-dependency-performance`, body);
  } catch (error: any) {
    console.warn(
      `[telemetryRuntimeDependencyPerformance] Failed to send dependency telemetry:`,
      error?.message || error
    );
    return null;
  }
};

export const inviteUserService = async (
  projectId: string,
  newUser: {
    email: string;
    uid: string;
    roles: string[];
  },
  inviter: {
    email: string;
    uid: string;
    name: string;
  }
): Promise<{
  dependencies: { [key: string]: string };
  extension: string;
  syncScript?: string;
}> => {
  const axiosInstance = await getAxiosInstance();
  return (
    await axiosInstance.post(`inviteUser`, {
      projectId,
      newUser,
      inviter,
    })
  ).data;
};

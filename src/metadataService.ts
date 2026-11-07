import { Request, Response } from "express";
import axios from "axios";
import { env } from "process";

const axiosInstance = axios.create({
  baseURL: "http://metadata.google.internal/",
  timeout: 1000,
  headers: { "Metadata-Flavor": "Google" },
});

export const metadataService = (req: Request, res: Response) => {
  let path =
    req.query.path ||
    "computeMetadata/v1/instance/service-accounts/default/scopes";
  axiosInstance.get(path as string).then((response) => {
    res.send({ data: response.data });
  });
};
export const getServiceAccountEmail = async () =>
  (
    await axiosInstance.get("computeMetadata/v1/instance/service-accounts")
  ).data.split("\n")[1];
export const getProjectId = async () => {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.PROJECT_ID) return process.env.PROJECT_ID;
  try {
    return (await axiosInstance.get("computeMetadata/v1/project/project-id")).data;
  } catch (e) {
    return "unknown-project";
  }
};
export const getNumericProjectId = async () =>
  (await axiosInstance.get("computeMetadata/v1/project/numeric-project-id"))
    .data;

export const generateServiceAccessToken = async (audience) =>
  (
    await axiosInstance.get(
      `computeMetadata/v1/instance/service-accounts/default/identity?audience=${audience}`
    )
  ).data;
//https://www.googleapis.com/oauth2/v1/certs

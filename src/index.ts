import express from "express";
import cors from "cors";
import { hasAnyRole, requireAuth } from "./middleware/auth";
import {
  deleteUser,
  impersonateUser,
  inviteUser,
  setUserRoles,
} from "./userManagement";
import {
  getFirestoreRules,
  listCollections,
  setFirestoreRules,
} from "./firestore";
import { actionScript } from "./scripts/action";
import { evaluateDerivative } from "./scripts/derivative";
import { functionBuilder } from "./functionBuilder";
import {
  version,
  region,
  serviceAccountAccess,
  setOwnerRoles,
  getOwner,
} from "./setup";
import { checkIfFTMigrationRequired, migrateFT2Rowy } from "./setup/ft2rowy";
import firebase from "firebase-admin";
import { getAlgoliaSearchKey } from "./connectTable/algolia";

import { metadataService, getProjectId } from "./metadataService";
import { getLogs } from "./logging";
import { auditChange } from "./logging/auditChange";
import { telemetryError } from "./rowyService";
import {
  listSecrets,
  addSecret,
  editSecret,
  deleteSecret,
} from "./secretManager";
import { connector } from "./scripts/connector";
import { triggerJob } from "./runJobs";

const app = express();
// json is the default content-type for POST requests
app.use(express.json());

app.use(cors());

app.get("/", async (req, res) => {
  const projectId = await getProjectId();
  try {
    res.redirect(`https://${projectId}.rowy.app`);
  } catch (error) {
    res.redirect(`https://deploy.rowy.app`);
  }
});
const functionWrapper = (fn) => async (req, res) => {
  const user: firebase.auth.UserRecord = res.locals.user;
  try {
    const data = await fn(req, user);
    res.status(200).send(data);
  } catch (error) {
    console.error(error);
    try {
      await telemetryError(req.path.slice(1), error);
    } catch (telemetryErr) {
      console.warn("[functionWrapper] telemetryError failed:", telemetryErr);
    }
    res.status(500).send(error);
  }
};
// rowy Run Setup
// get version
app.get("/version", functionWrapper(version));
app.get("/region", functionWrapper(region));

app.get("/serviceAccountAccess", serviceAccountAccess);
app.get("/projectOwner", functionWrapper(getOwner));

app.get("/setOwnerRoles", requireAuth, setOwnerRoles);

app.get(
  "/listCollections",
  requireAuth,
  hasAnyRole(["ADMIN"]),
  functionWrapper(listCollections)
);

app.get(
  "/firestoreRules",
  requireAuth,
  hasAnyRole(["ADMIN", "OWNER"]),
  functionWrapper(getFirestoreRules)
);

app.post(
  "/setFirestoreRules",
  requireAuth,
  hasAnyRole(["ADMIN", "OWNER"]),
  functionWrapper(setFirestoreRules)
);

//FT Migration

app.get(
  "/checkFT2Rowy",
  requireAuth,
  hasAnyRole(["ADMIN", "OWNER"]),
  checkIfFTMigrationRequired
);
app.get(
  "/migrateFT2Rowy",
  requireAuth,
  hasAnyRole(["ADMIN", "OWNER"]),
  functionWrapper(migrateFT2Rowy)
);

// USER MANAGEMENT

// invite users
app.post("/inviteUser", requireAuth, hasAnyRole(["ADMIN"]), inviteUser);

//set user roles
app.post("/setUserRoles", requireAuth, hasAnyRole(["ADMIN"]), setUserRoles);

// delete user
app.delete("/deleteUser", requireAuth, hasAnyRole(["ADMIN"]), deleteUser);

// impersonate user
app.get(
  "/impersonateUser/:email",
  requireAuth,
  hasAnyRole(["ADMIN"]),
  impersonateUser
);
// action script
app.post("/actionScript", requireAuth, actionScript);

//
app.post("/evaluateDerivative", requireAuth, evaluateDerivative);
app.post("/connector", requireAuth, connector);

// Function Builder
app.post(
  "/buildFunction",
  requireAuth,
  hasAnyRole(["ADMIN"]),
  functionWrapper(functionBuilder)
);

app.get("/logs", requireAuth, hasAnyRole(["ADMIN"]), functionWrapper(getLogs));

// metadata service
app.get("/metadata", requireAuth, hasAnyRole(["ADMIN"]), metadataService);

// get algoia search key
app.get(
  "/algoliaSearchKey/:index",
  requireAuth,
  functionWrapper(getAlgoliaSearchKey)
);

app.get(
  "/algoliaAppId",
  requireAuth,
  functionWrapper(() => {
    if (process.env.ALGOLIA_APPLICATION_ID) {
      return { appId: process.env.ALGOLIA_APPLICATION_ID, success: true };
    } else {
      return { success: false, message: "Algolia is not setup" };
    }
  })
);

app.post("/auditChange", requireAuth, functionWrapper(auditChange));

// SECRET MANAGEMENT
app.get(
  "/listSecrets",
  requireAuth,
  hasAnyRole(["ADMIN"]),
  functionWrapper(listSecrets)
);
app.post("/addSecret", requireAuth, hasAnyRole(["ADMIN"]), addSecret);
app.post("/editSecret", requireAuth, hasAnyRole(["ADMIN"]), editSecret);
app.post("/deleteSecret", requireAuth, hasAnyRole(["ADMIN"]), deleteSecret);

app.post(
  "/triggerJob",
  requireAuth,
  hasAnyRole(["ADMIN"]),
  functionWrapper(triggerJob)
);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`rowyRun: listening on port ${port}`);
});

// Exports for testing purposes.
module.exports = app;

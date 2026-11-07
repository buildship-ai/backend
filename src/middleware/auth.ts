import { auth } from "../firebaseConfig";
import { telemetry, telemetryError } from "../rowyService";
import { Request } from "express";

export const requireAuth = async (req: Request, res: any, next: any) => {
  try {
    const authHeader = req.get("Authorization");
    if (!authHeader) return res.status(401).send("Unauthorized");
    const authToken = authHeader.split(" ")[1];
    const decodedToken = await auth.verifyIdToken(authToken);
    res.locals.user = decodedToken;
    telemetry(req.path.slice(1)).catch((err) => {
      console.warn(`[auth] telemetry failed:`, err?.message || err);
    });
    next();
  } catch (error: any) {
    try {
      await telemetryError(req.path.slice(1), error);
    } catch (telemetryErr: any) {
      console.warn(`[auth] telemetryError failed:`, telemetryErr?.message || telemetryErr);
    }
    res.sendStatus(401);
  }
};

export const hasAnyRole =
  (roles: string[]) => async (req: any, res: any, next: Function) => {
    const user = res.locals.user;
    try {
      const userRoles: string[] = user.roles;
      // user roles must have at least one of the roles
      const authorized = roles.some((role) => userRoles.includes(role));
      if (authorized) {
        next();
      } else {
        const latestUser = await auth.getUser(user.uid);
        const authDoubleCheck = roles.some((role) =>
          latestUser.customClaims.roles.includes(role)
        );
        if (authDoubleCheck) {
          next();
        } else {
          res.status(401).send({
            error: "Unauthorized",
            message: "User does not have any of the required roles",
            roles,
          });
        }
      }
    } catch (error) {
      try {
        await telemetryError(req.path.slice(1), error);
      } catch (telemetryErr: any) {
        console.warn(`[auth] telemetryError failed:`, telemetryErr?.message || telemetryErr);
      }
      res.status(401);
    }
  };

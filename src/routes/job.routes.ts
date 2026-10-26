import { Router } from "express";
import { handleCreateAccountJob } from "../controllers/job.controller.js";

const jobRouter = Router();

jobRouter.post("/create-account", handleCreateAccountJob);

export default jobRouter;

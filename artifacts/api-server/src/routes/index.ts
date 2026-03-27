import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stopsRouter from "./stops";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stopsRouter);
router.use(storageRouter);

export default router;

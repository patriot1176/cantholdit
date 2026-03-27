import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stopsRouter from "./stops";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stopsRouter);

export default router;

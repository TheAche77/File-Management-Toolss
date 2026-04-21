import { Router, type IRouter } from "express";
import healthRouter from "./health";
import galleriesRouter from "./galleries";

const router: IRouter = Router();

router.use(healthRouter);
router.use(galleriesRouter);

export default router;

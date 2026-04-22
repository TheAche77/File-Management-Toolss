import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import outreachRouter from "./outreach";
import importsRouter from "./imports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(outreachRouter);
router.use(importsRouter);

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import businessesRouter from "./businesses";
import slgRouter from "./slg";

const router: IRouter = Router();

router.use(healthRouter);
router.use(businessesRouter);
router.use(slgRouter);
router.use("/slg", slgRouter);

export default router;

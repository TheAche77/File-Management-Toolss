import { Router } from "express";
import { businessesResearchRouter } from "./businesses/businesses.research.routes";
import { businessesOutreachRouter } from "./businesses/businesses.outreach.routes";
import { businessesImportRouter } from "./businesses/businesses.import.routes";
import { businessesExportRouter } from "./businesses/businesses.export.routes";
import { businessesCatalogRouter } from "./businesses/businesses.catalog.routes";

const router = Router();

router.use(businessesResearchRouter);
router.use(businessesOutreachRouter);
router.use(businessesImportRouter);
router.use(businessesExportRouter);
router.use(businessesCatalogRouter);

export default router;

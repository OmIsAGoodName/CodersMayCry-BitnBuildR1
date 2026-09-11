import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inboxRouter from "./inbox";
import ordersRouter from "./orders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(inboxRouter);
router.use(ordersRouter);

export default router;

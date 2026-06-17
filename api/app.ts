import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDatabase } from './db/database.js'
import { generateMockData } from './db/mockData.js'
import funnelRoutes from './routes/funnels.js'
import analysisRoutes from './routes/analysis.js'
import metaRoutes from './routes/meta.js'
import reportRoutes from './routes/reports.js'
import monitorRoutes from './routes/monitors.js'
import { startMonitorScheduler } from './services/monitorService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

initDatabase()
generateMockData()

try {
  startMonitorScheduler()
} catch (error) {
  console.error('Failed to start monitor scheduler:', error)
}

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api', analysisRoutes)
app.use('/api/funnels', funnelRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/monitors', monitorRoutes)
app.use('/api', metaRoutes)

app.use(
  '/api/health',
  (_req: Request, res: Response, _next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
    message: error.message,
  })
})

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app

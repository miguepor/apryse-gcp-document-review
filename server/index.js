import express from 'express'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const app = express()
const port = 8080

// Resolve storage relative to this source file.
const dataDirectory = fileURLToPath(
  new URL('../local-data/', import.meta.url),
)

const annotationFile = path.join(
  dataDirectory,
  'annotations.xfdf',
)

// Accept JSON requests, with a maximum body size of 1 MB.
app.use(express.json({ limit: '1mb' }))

// Review responses should always reflect the latest saved file.
app.use('/api', (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
})

// Confirm that the API is running.
app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'document-review-api',
  })
})

// Retrieve the saved annotations.
app.get('/api/documents/demo/annotations', async (_request, response) => {
  try {
    const xfdf = await readFile(annotationFile, 'utf8')
    response.json({ xfdf })
  } catch (error) {
    if (error.code === 'ENOENT') {
      return response.json({ xfdf: '' })
    }

    throw error
  }
})

// Replace the saved annotations.
app.put('/api/documents/demo/annotations', async (request, response) => {
  const xfdf = request.body?.xfdf

  if (typeof xfdf !== 'string') {
    return response.status(400).json({
      error: 'The request must contain an xfdf string.',
    })
  }

  await mkdir(dataDirectory, { recursive: true })

  // Write a complete temporary file before replacing the saved review.
  const temporaryFile = path.join(
    dataDirectory,
    `${randomUUID()}.tmp`,
  )

  await writeFile(temporaryFile, xfdf, 'utf8')
  await rename(temporaryFile, annotationFile)

  response.json({ status: 'saved' })
})

// Return predictable JSON errors.
app.use((error, _request, response, next) => {
  if (response.headersSent) {
    return next(error)
  }

  if (error.type === 'entity.too.large') {
    return response.status(413).json({
      error: 'The review exceeds the 1 MB request limit.',
    })
  }

  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({
      error: 'The request body must be valid JSON.',
    })
  }

  console.error('API error:', error.code || error.name)

  response.status(500).json({
    error: 'The server could not complete the request.',
  })
})

app.listen(port, '127.0.0.1', () => {
  console.log(`API running at http://localhost:${port}`)
})
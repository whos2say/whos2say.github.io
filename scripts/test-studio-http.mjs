#!/usr/bin/env node
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const routes = ['/studio/', '/studio/participants/profile/']

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')
  let pathname = url.pathname
  if (pathname.endsWith('/')) pathname += 'index.html'
  const filePath = path.join(root, pathname.replace(/^\/+/, ''))
  fs.readFile(filePath, (error, body) => {
    if (error) {
      response.statusCode = 404
      response.end('not found')
      return
    }
    response.end(body)
  })
})

server.listen(0, async () => {
  try {
    const { port } = server.address()
    for (const route of routes) {
      const response = await fetch(`http://127.0.0.1:${port}${route}`)
      if (!response.ok) throw new Error(`${route} returned HTTP ${response.status}`)
    }
    console.log('Studio HTTP checks passed')
  } finally {
    server.close()
  }
})

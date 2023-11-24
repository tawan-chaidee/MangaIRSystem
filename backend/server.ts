// const express = require('express')
import express, { Request } from 'express';
import path from 'path';
import elastic from '@elastic/elasticsearch';
import dotenv from 'dotenv';
import {app as SearchRoute} from './routes/search.js';
dotenv.config({ path: path.resolve('../.env') });
import cors from 'cors';


const app = express()
const port = 3000

app.use(cors())

export const client = new elastic.Client({ node: process.env.ELASTICSEARCH_URL })

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

app.use('/image',
  (req, res, next) => {
    console.log(path.resolve('../tools/manga_images'))
    next()
  },
  express.static(path.resolve('../tools/manga_images'))
)

export interface MangaSearchResult {
  title: string
  alternativeTitle: string
  authors: string[]
  description: string
  background: string
  genres: string[]
  members: number
  score: number
  characters: {
    name: string
    role: string
    popularity: number
  }[]
  url: string
}

app.use('/search',SearchRoute)
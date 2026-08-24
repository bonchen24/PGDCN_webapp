// Author: Gemini
// OS support: Web/Node
// Description: Express server with Gemini API integration for Electrical-Electronics Department
import express from "express";
import compression from "compression";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";
import * as xlsx from "xlsx";
import multer from "multer";
import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import sizeOf from "image-size";
// @ts-ignore
import { Client as FtpClient } from "basic-ftp";
import { Readable } from "stream";
import { Resvg } from "@resvg/resvg-js";
import { createServer as createHttpServer } from "http";
import { initDbSchema, pool } from "./utils/db.js";
import {
  GEMINI_API_KEY_MISSING_MESSAGE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_CODE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_MESSAGE,
  isGeminiUpstreamUnavailable,
  resolveGeminiApiKey,
} from "./utils/geminiCredentials.js";
import { chooseRadimationImageSource, isCompleteVectorComposite, stripFullCanvasWhiteBackground } from "./utils/radimationLayers.js";
import { buildReportDocxImageSlots, combineReportDocxLabelImages, getReportDocxLabelImages } from "./lib/reportDocxImageMapping.js";
import { buildReportDocxMetadata } from "./lib/reportDocxMetadata.js";
import { getDocxGraphSize } from "./lib/reportDocxImageSizing.js";
import { buildActivityLog, isValidActivityTimestamp } from "./utils/activityLog.js";
import { REPORT_TEMPLATES_CATALOG, ReportTemplateMetadata } from "./lib/reportTemplatesCatalog.js";
import { createHash } from "crypto";
import { createSupabaseStorageClient } from "./utils/supabaseStorage.js";
import { normalizeSystemUserRole } from "./utils/systemUserRole.js";
import {
  applyRetention,
  createBackup,
  deleteBackup,
  getBackupPath,
  isPgToolAvailable,
  listBackups,
  restoreBackup,
} from "./utils/backupManager.js";

const dynamicImport = new Function("modulePath", "return import(modulePath)");
let _emfOrWmfToSvg: any = null;
async function getEmfOrWmfToSvg() {
  if (!_emfOrWmfToSvg) {
    const mod = await dynamicImport("emf-to-png");
    _emfOrWmfToSvg = mod.emfOrWmfToSvg;
  }
  return _emfOrWmfToSvg;
}

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

const KQTN_PDF_MAX_BYTES = Number(process.env.KQTN_PDF_MAX_BYTES || 25 * 1024 * 1024);
const kqtnPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: KQTN_PDF_MAX_BYTES },
});

function getKqtnStorageClient() {
  const baseUrl = String(process.env.SUPABASE_STORAGE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('KQTN PDF storage is not configured. Set SUPABASE_STORAGE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createSupabaseStorageClient({ baseUrl, serviceRoleKey });
}

function getKqtnStorageBucket(): string {
  return String(process.env.SUPABASE_STORAGE_BUCKET || 'ddt-files').trim() || 'ddt-files';
}

function sanitizeKqtnPathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100) || 'record';
}

function getKqtnPdfMetadata(data: any): any | null {
  const value = data?.resultPdf;
  return value && typeof value === 'object' && value.objectPath ? value : null;
}


const DB_COLLECTIONS = new Set([
  "requests",
  "handoverDocs",
  "kqtnRecords",
  "customers",
  "products",
  "brands",
  "systemUsers",
  "systemConfig",
  "userPreferences",
  "passwordResetRequests",
  "notifications",
  "testers",
  "dayConfigs"
]);

function getDbCollection(req: express.Request, res: express.Response): string | null {
  const collectionName = decodeURIComponent(String(req.params.collection || ""));
  if (!DB_COLLECTIONS.has(collectionName)) {
    res.status(404).json({ error: `Collection không hợp lệ: ${collectionName}` });
    return null;
  }
  return collectionName;
}

function getDocumentPayload(value: any): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const data = { ...value };
  delete data.id;
  return data;
}

function mapDocumentRow(row: { document_id: string; data: Record<string, any> }) {
  return { ...(row.data || {}), id: row.document_id };
}

const ACTIVITY_LOG_ACTIONS = new Set([
  "CREATED",
  "UPDATED",
  "DELETED",
  "STATUS_CHANGED",
  "SCHEDULED",
  "UNSCHEDULED",
  "ASSIGNED",
  "IMPORTED",
  "RESTORED",
  "CONFIGURED"
]);

const ACTIVITY_LOG_ENTITY_TYPES = new Set([
  "REQUEST",
  "HANDOVER_DOC",
  "KQTN_RECORD",
  "SCHEDULE",
  "USER",
  "CUSTOMER",
  "PRODUCT",
  "BRAND",
  "SYSTEM_SETTINGS",
  "SYSTEM"
]);

const ACTIVITY_LOG_SOURCES = new Set(["UI", "IMPORT", "RESTORE", "SYSTEM"]);

function getActivityQueryText(req: express.Request, key: string): string {
  const raw = req.query[key];
  return String(Array.isArray(raw) ? raw[0] || "" : raw || "").trim();
}

function getActivityQueryValues(req: express.Request, key: string): string[] {
  const raw = req.query[key];
  return (Array.isArray(raw) ? raw : [raw])
    .map(value => String(value || "").trim())
    .filter(Boolean);
}

function normalizeActivityDateBound(value: string, endOfDay = false): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const baseUtc = Date.UTC(year, month - 1, day + (endOfDay ? 1 : 0), 0, 0, 0, 0);
    const utcMillis = baseUtc - (7 * 60 * 60 * 1000) - (endOfDay ? 1 : 0);
    return new Date(utcMillis).toISOString();
  }
  return value;
}

function encodeActivityCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id }), "utf8").toString("base64url");
}

function decodeActivityCursor(rawCursor: string): { createdAt: string; id: string } | null {
  if (!rawCursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
    if (!parsed || typeof parsed.createdAt !== "string" || typeof parsed.id !== "string" || !parsed.createdAt || !parsed.id) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

function validateActivityLogPayload(value: any): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Activity log phải là object";
  if (!String(value.id || "").trim()) return "Activity log thiếu id";
  const createdAt = String(value.createdAt || "").trim();
  if (!createdAt) return "Activity log thiếu createdAt";
  if (!isValidActivityTimestamp(createdAt)) return "Activity log có createdAt không hợp lệ";
  if (!String(value.actorName || "").trim()) return "Activity log thiếu actorName";
  if (!ACTIVITY_LOG_ACTIONS.has(String(value.action))) return "Activity log có action không hợp lệ";
  if (!ACTIVITY_LOG_ENTITY_TYPES.has(String(value.entityType))) return "Activity log có entityType không hợp lệ";
  if (!String(value.summary || "").trim()) return "Activity log thiếu summary";
  if (!ACTIVITY_LOG_SOURCES.has(String(value.source))) return "Activity log có source không hợp lệ";
  return null;
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const username = String(req.headers["x-user-name"] || "").trim();
  if (!username) {
    res.status(401).json({ error: "Thiếu thông tin người dùng." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT data FROM app_documents WHERE collection_name = 'systemUsers' AND document_id = $1`,
      [username]
    );
    const role = result.rows[0] ? normalizeSystemUserRole(result.rows[0].data) : null;
    if (role !== "admin") {
      res.status(403).json({ error: "Chỉ Admin mới có quyền thực hiện thao tác này." });
      return;
    }
    next();
  } catch (error: any) {
    console.error("Admin auth check error:", error);
    res.status(500).json({ error: error?.message || String(error) });
  }
}

async function withPgTransaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const CANDIDATE_MODELS = ["gemini-flash-latest", "gemini-3.6-flash", "gemini-3.1-flash-lite"];

async function generateContentWithRetryAndFallback(
  activeAi: GoogleGenAI,
  params: { contents: any; config?: any },
  preferredModel?: string
) {
  let lastError: any = null;
  const modelsToTry = preferredModel ? [preferredModel, ...CANDIDATE_MODELS.filter(m => m !== preferredModel)] : CANDIDATE_MODELS;

  for (const modelName of modelsToTry) {
    let retries = 2;
    while (retries > 0) {
      try {
        console.log(`Calling Gemini API with model: ${modelName} (retries left: ${retries - 1})...`);
        const response = await activeAi.models.generateContent({
          ...params,
          model: modelName,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        console.warn(`Gemini model ${modelName} error:`, errMsg);

        const isQuotaOrNotFound = 
          errMsg.includes("limit: 0") || 
          errMsg.includes("Quota exceeded") ||
          errMsg.includes("free_tier") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("429") ||
          errMsg.includes("404") ||
          errMsg.includes("NOT_FOUND") ||
          errMsg.includes("not found");

        if (isQuotaOrNotFound) {
          console.warn(`Model ${modelName} encountered quota or model availability issue, switching to next model...`);
          break;
        }

        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("demand") ||
          errMsg.includes("overloaded");

        if (isTransient) {
          retries--;
          if (retries > 0) {
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
        }
        break;
      }
    }
  }

  const errorString = String(lastError?.message || lastError || "");
  if (errorString.includes("Quota exceeded") || errorString.includes("limit: 0") || errorString.includes("RESOURCE_EXHAUSTED") || errorString.includes("free_tier")) {
    throw new Error("Hạn ngạch AI miễn phí của hệ thống đã vượt quá giới hạn (Quota Exceeded). Vui lòng vào góc trên bên phải màn hình -> biểu tượng Tài khoản / Cài đặt cá nhân để nhập Gemini API Key cá nhân của bạn.");
  }

  if (errorString.includes("503") || errorString.includes("UNAVAILABLE") || errorString.includes("high demand") || errorString.includes("overloaded")) {    throw new Error("Hệ thống AI (Gemini) hiện đang bị quá tải hoặc phản hồi chậm do nhu cầu cao (503). Vui lòng thử lại sau vài phút.");  }
  throw lastError || new Error("Hệ thống AI đang quá tải hoặc hết hạn ngạch. Vui lòng thử lại sau giây lát.");
}

async function createChatWithRetryAndFallback(
  activeAi: GoogleGenAI,
  params: { config?: any; history?: any },
  message: string,
  preferredModel?: string
) {
  let lastError: any = null;
  const modelsToTry = preferredModel ? [preferredModel, ...CANDIDATE_MODELS.filter(m => m !== preferredModel)] : CANDIDATE_MODELS;

  for (const modelName of modelsToTry) {
    let retries = 2;
    while (retries > 0) {
      try {
        console.log(`Creating Gemini Chat with model: ${modelName}...`);
        const chat = activeAi.chats.create({
          ...params,
          model: modelName,
        });
        const response = await chat.sendMessage({ message });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        console.warn(`Gemini Chat model ${modelName} error:`, errMsg);

        const isQuotaOrNotFound = 
          errMsg.includes("limit: 0") || 
          errMsg.includes("Quota exceeded") ||
          errMsg.includes("free_tier") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("429") ||
          errMsg.includes("404") ||
          errMsg.includes("NOT_FOUND") ||
          errMsg.includes("not found");

        if (isQuotaOrNotFound) {
          console.warn(`Chat model ${modelName} encountered quota or availability issue, switching to next model...`);
          break;
        }

        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("demand") ||
          errMsg.includes("overloaded");

        if (isTransient) {
          retries--;
          if (retries > 0) {
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
        }
        break;
      }
    }
  }

  const errorString = String(lastError?.message || lastError || "");
  if (errorString.includes("Quota exceeded") || errorString.includes("limit: 0") || errorString.includes("RESOURCE_EXHAUSTED") || errorString.includes("free_tier")) {
    throw new Error("Hạn ngạch AI miễn phí của hệ thống đã vượt quá giới hạn (Quota Exceeded). Vui lòng vào góc trên bên phải màn hình -> biểu tượng Tài khoản / Cài đặt cá nhân để nhập Gemini API Key cá nhân của bạn.");
  }

  if (errorString.includes("503") || errorString.includes("UNAVAILABLE") || errorString.includes("high demand") || errorString.includes("overloaded")) {    throw new Error("Hệ thống AI (Gemini) hiện đang bị quá tải hoặc phản hồi chậm do nhu cầu cao (503). Vui lòng thử lại sau vài phút.");  }
  throw lastError || new Error("Hệ thống Trợ lý AI đang quá tải. Vui lòng thử lại sau giây lát.");
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || (process.env.NODE_ENV === "production" ? 2359 : 1359));

  app.use(compression());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const getGeminiClient = (req: express.Request) => {
    const resolvedApiKey = resolveGeminiApiKey(apiKey, req.headers['x-gemini-api-key']);
    if (!resolvedApiKey) {
      throw new Error(GEMINI_API_KEY_MISSING_MESSAGE);
    }
    return new GoogleGenAI({
      apiKey: resolvedApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };


  app.post("/api/kqtn/:recordId/pdf", kqtnPdfUpload.single("file"), async (req, res) => {
    const recordId = String(req.params.recordId || "").trim();
    const file = req.file;
    if (!recordId) {
      res.status(400).json({ error: "Missing KQTN record id." });
      return;
    }
    if (!file) {
      res.status(400).json({ error: "A PDF file is required." });
      return;
    }
    if (file.mimetype !== "application/pdf" || file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      res.status(415).json({ error: "Only valid PDF files are accepted." });
      return;
    }

    const bucketName = getKqtnStorageBucket();
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const objectPath = "kqtnRecords/" + sanitizeKqtnPathSegment(recordId) + "/result-" + sha256 + ".pdf";
    const assetId = "kqtn-pdf-" + sanitizeKqtnPathSegment(recordId) + "-" + sha256.slice(0, 16);
    try {
      const storage = getKqtnStorageClient();
      const existing = await pool.query(
        "SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2",
        ["kqtnRecords", recordId],
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: "KQTN record not found." });
        return;
      }
      const oldPdf = getKqtnPdfMetadata(existing.rows[0].data);
      await storage.ensurePrivateBucket(bucketName, KQTN_PDF_MAX_BYTES);
      await storage.uploadObject({
        bucketName,
        objectPath,
        body: file.buffer,
        mimeType: "application/pdf",
      });

      const metadata = {
        assetId,
        bucketName,
        objectPath,
        originalName: String(file.originalname || "result.pdf").replace(/[\\"]/g, "_").slice(0, 255),
        mimeType: "application/pdf",
        byteSize: file.size,
        sha256,
        uploadedAt: new Date().toISOString(),
        uploadedBy: String(req.headers["x-user-name"] || "KTV"),
      };

      try {
        await withPgTransaction(async (client) => {
          const locked = await client.query(
            "SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 FOR UPDATE",
            ["kqtnRecords", recordId],
          );
          if (locked.rows.length === 0) throw new Error("KQTN record not found.");
          const currentData = locked.rows[0].data || {};
          const currentPdf = getKqtnPdfMetadata(currentData);
          const nextData = { ...currentData, resultPdf: metadata };
          await client.query(
            "UPDATE app_documents SET data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $2 AND document_id = $3",
            [JSON.stringify(getDocumentPayload({ ...nextData, id: recordId })), "kqtnRecords", recordId],
          );
          if (currentPdf?.assetId) {
            await client.query("DELETE FROM file_assets WHERE id = $1", [currentPdf.assetId]);
          }
          await client.query(
            "INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET bucket_name = EXCLUDED.bucket_name, object_path = EXCLUDED.object_path, byte_size = EXCLUDED.byte_size, sha256 = EXCLUDED.sha256, updated_at = CURRENT_TIMESTAMP",
            [assetId, bucketName, objectPath, "kqtnRecords", recordId, "resultPdf", "application/pdf", file.size, sha256],
          );
        });
      } catch (error) {
        await storage.deleteObject({ bucketName, objectPath }).catch(() => undefined);
        throw error;
      }

      if (oldPdf?.objectPath && oldPdf.objectPath !== objectPath) {
        await storage.deleteObject({ bucketName: oldPdf.bucketName || bucketName, objectPath: oldPdf.objectPath }).catch((error) => {
          console.warn("Unable to remove replaced KQTN PDF object:", error);
        });
      }
      res.status(201).json({ recordId, resultPdf: metadata });
    } catch (error: any) {
      console.error("KQTN PDF upload error:", error);
      const status = String(error?.message || "").includes("storage is not configured") ? 503 : 500;
      res.status(status).json({ error: error?.message || String(error) });
    }
  });

  app.get("/api/kqtn/:recordId/pdf", async (req, res) => {
    const recordId = String(req.params.recordId || "").trim();
    try {
      const result = await pool.query(
        "SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2",
        ["kqtnRecords", recordId],
      );
      const pdf = getKqtnPdfMetadata(result.rows[0]?.data);
      if (!pdf) {
        res.status(404).json({ error: "KQTN PDF not found." });
        return;
      }
      const storage = getKqtnStorageClient();
      const downloaded = await storage.downloadObject({
        bucketName: pdf.bucketName || getKqtnStorageBucket(),
        objectPath: pdf.objectPath,
      });
      const safeName = String(pdf.originalName || "result.pdf").replace(/["\\r\\n]/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", downloaded.body.byteLength);
      res.setHeader("Content-Disposition", (req.query.download ? "attachment" : "inline") + "; filename=\"" + safeName + "\"");
      res.send(downloaded.body);
    } catch (error: any) {
      console.error("KQTN PDF download error:", error);
      const status = String(error?.message || "").includes("storage is not configured") ? 503 : 500;
      res.status(status).json({ error: error?.message || String(error) });
    }
  });

  app.delete("/api/kqtn/:recordId/pdf", async (req, res) => {
    const recordId = String(req.params.recordId || "").trim();
    try {
      const result = await pool.query(
        "SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2",
        ["kqtnRecords", recordId],
      );
      const pdf = getKqtnPdfMetadata(result.rows[0]?.data);
      if (!pdf) {
        res.status(404).json({ error: "KQTN PDF not found." });
        return;
      }
      const storage = getKqtnStorageClient();
      await storage.deleteObject({
        bucketName: pdf.bucketName || getKqtnStorageBucket(),
        objectPath: pdf.objectPath,
      });
      await withPgTransaction(async (client) => {
        const locked = await client.query(
          "SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 FOR UPDATE",
          ["kqtnRecords", recordId],
        );
        if (locked.rows.length === 0) throw new Error("KQTN record not found.");
        const data = { ...(locked.rows[0].data || {}) };
        delete data.resultPdf;
        await client.query(
          "UPDATE app_documents SET data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $2 AND document_id = $3",
          [JSON.stringify(getDocumentPayload({ ...data, id: recordId })), "kqtnRecords", recordId],
        );
        if (pdf.assetId) await client.query("DELETE FROM file_assets WHERE id = $1", [pdf.assetId]);
      });
      res.json({ deleted: true, recordId });
    } catch (error: any) {
      console.error("KQTN PDF delete error:", error);
      const status = String(error?.message || "").includes("storage is not configured") ? 503 : 500;
      res.status(status).json({ error: error?.message || String(error) });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/db/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "postgresql" });
    } catch (error: any) {
      res.status(503).json({ status: "error", database: "postgresql", error: error?.message || String(error) });
    }
  });

  app.get("/api/activity-logs/summary", async (req, res) => {
    const params: any[] = ["activityLogs"];
    const conditions = ["collection_name = $1"];
    const addParam = (value: any): string => {
      params.push(value);
      return `$${params.length}`;
    };
    const actors = getActivityQueryValues(req, "actor");
    const from = getActivityQueryText(req, "from");
    const to = getActivityQueryText(req, "to");

    if (actors.length === 1) conditions.push(`data->>'actorUsername' = ${addParam(actors[0])}`);
    if (actors.length > 1) conditions.push(`data->>'actorUsername' = ANY(${addParam(actors)})`);
    if (from) conditions.push(`data->>'createdAt' >= ${addParam(normalizeActivityDateBound(from))}`);
    if (to) conditions.push(`data->>'createdAt' <= ${addParam(normalizeActivityDateBound(to, true))}`);

    try {
      const result = await pool.query(`
        SELECT
          COALESCE(data->>'actorUsername', '') AS "actorUsername",
          MAX(COALESCE(data->>'actorName', 'Hệ thống')) AS "actorName",
          COUNT(*)::int AS "totalActions",
          COUNT(DISTINCT CASE WHEN data->>'entityType' = 'REQUEST' AND data->>'action' = 'CREATED' THEN NULLIF(data->>'entityId', '') END)::int AS "requestsCreated",
          COUNT(DISTINCT CASE WHEN data->>'entityType' = 'KQTN_RECORD' AND data->>'action' IN ('CREATED', 'UPDATED') THEN NULLIF(data->>'entityId', '') END)::int AS "samplesProcessed",
          COUNT(DISTINCT CASE WHEN data->>'entityType' = 'KQTN_RECORD' AND data->>'action' = 'UPDATED' THEN NULLIF(data->>'entityId', '') END)::int AS "kqtnUpdated",
          COUNT(DISTINCT CASE WHEN data->>'entityType' = 'HANDOVER_DOC' AND data->>'action' = 'CREATED' THEN NULLIF(data->>'entityId', '') END)::int AS "handoversCreated",
          COUNT(*) FILTER (WHERE data->>'action' IN ('ASSIGNED', 'SCHEDULED', 'UNSCHEDULED', 'STATUS_CHANGED'))::int AS "workActions",
          COUNT(*) FILTER (WHERE data->>'entityType' = 'REQUEST')::int AS "requestActions",
          COUNT(*) FILTER (WHERE data->>'entityType' = 'KQTN_RECORD')::int AS "kqtnActions",
          COUNT(*) FILTER (WHERE data->>'entityType' = 'HANDOVER_DOC')::int AS "handoverActions",
          COUNT(*) FILTER (WHERE data->>'entityType' = 'SCHEDULE')::int AS "scheduleActions",
          COUNT(*) FILTER (WHERE data->>'entityType' NOT IN ('REQUEST', 'KQTN_RECORD', 'HANDOVER_DOC', 'SCHEDULE'))::int AS "otherActions",
          MAX(data->>'createdAt') AS "lastActivityAt"
        FROM app_documents
        WHERE ${conditions.join(" AND ")}
        GROUP BY data->>'actorUsername'
        ORDER BY COUNT(*) DESC, MAX(COALESCE(data->>'actorName', 'Hệ thống')) ASC`, params);
      res.json({ items: result.rows });
    } catch (error: any) {
      console.error("PostgreSQL activity KPI summary error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.get("/api/activity-logs", async (req, res) => {
    const rawLimit = getActivityQueryText(req, "limit");
    const parsedLimit = rawLimit ? Number(rawLimit) : 50;
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      res.status(400).json({ error: "limit phải nằm trong khoảng 1 đến 100" });
      return;
    }

    const limit = Math.trunc(parsedLimit);
    const cursorValue = getActivityQueryText(req, "cursor");
    const cursor = cursorValue ? decodeActivityCursor(cursorValue) : null;
    if (cursorValue && !cursor) {
      res.status(400).json({ error: "cursor không hợp lệ" });
      return;
    }

    const params: any[] = ["activityLogs"];
    const conditions = ["collection_name = $1"];
    const addParam = (value: any): string => {
      params.push(value);
      return `$${params.length}`;
    };

    const actors = getActivityQueryValues(req, "actor");
    const action = getActivityQueryText(req, "action");
    const entityType = getActivityQueryText(req, "entityType");
    const from = getActivityQueryText(req, "from");
    const to = getActivityQueryText(req, "to");
    const search = getActivityQueryText(req, "search");

    if (actors.length === 1) conditions.push(`data->>'actorUsername' = ${addParam(actors[0])}`);
    if (actors.length > 1) conditions.push(`data->>'actorUsername' = ANY(${addParam(actors)})`);
    if (action) conditions.push(`data->>'action' = ${addParam(action)}`);
    if (entityType) conditions.push(`data->>'entityType' = ${addParam(entityType)}`);
    if (from) conditions.push(`data->>'createdAt' >= ${addParam(normalizeActivityDateBound(from))}`);
    if (to) conditions.push(`data->>'createdAt' <= ${addParam(normalizeActivityDateBound(to, true))}`);
    if (search) {
      const searchParam = addParam(`%${search}%`);
      conditions.push(`(
        COALESCE(data->>'summary', '') ILIKE ${searchParam}
        OR COALESCE(data->>'entityLabel', '') ILIKE ${searchParam}
        OR COALESCE(data->>'requestCode', '') ILIKE ${searchParam}
        OR COALESCE(data->>'docNumber', '') ILIKE ${searchParam}
        OR COALESCE(data->>'reportNo', '') ILIKE ${searchParam}
      )`);
    }
    if (cursor) {
      const createdAtParam = addParam(cursor.createdAt);
      const idParam = addParam(cursor.id);
      conditions.push(`((data->>'createdAt') < ${createdAtParam} OR ((data->>'createdAt') = ${createdAtParam} AND document_id < ${idParam}))`);
    }

    const limitParam = addParam(limit + 1);
    const query = `
      SELECT document_id, data
      FROM app_documents
      WHERE ${conditions.join(" AND ")}
      ORDER BY data->>'createdAt' DESC, document_id DESC
      LIMIT ${limitParam}`;

    try {
      const result = await pool.query(query, params);
      const hasMore = result.rows.length > limit;
      const visibleRows = result.rows.slice(0, limit);
      const lastRow = visibleRows[visibleRows.length - 1];
      res.json({
        items: visibleRows.map(mapDocumentRow),
        nextCursor: hasMore && lastRow ? encodeActivityCursor(String(lastRow.data?.createdAt || ""), String(lastRow.document_id)) : null,
        hasMore,
      });
    } catch (error: any) {
      console.error("PostgreSQL activity log read error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.post("/api/activity-logs", async (req, res) => {
    const validationError = validateActivityLogPayload(req.body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const documentId = String(req.body.id).trim();
    const normalizedLog = buildActivityLog(req.body);
    try {
      const result = await pool.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING
         RETURNING document_id, data`,
        [documentId, JSON.stringify(getDocumentPayload(normalizedLog))]
      );
      if (result.rows.length === 0) {
        res.status(200).json({ id: documentId, duplicate: true });
        return;
      }
      res.status(201).json(mapDocumentRow(result.rows[0]));
    } catch (error: any) {
      console.error("PostgreSQL activity log write error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.post("/api/activity-logs/batch", async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length > 250) {
      res.status(400).json({ error: "Mỗi lần batch activity log chỉ được tối đa 250 bản ghi" });
      return;
    }
    for (let index = 0; index < items.length; index += 1) {
      const validationError = validateActivityLogPayload(items[index]);
      if (validationError) {
        res.status(400).json({ error: `Activity log thứ ${index + 1}: ${validationError}` });
        return;
      }
    }

    try {
      const inserted = await withPgTransaction(async (client) => {
        let count = 0;
        for (const item of items) {
          const normalizedLog = buildActivityLog(item);
          const result = await client.query(
            `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
             VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (collection_name, document_id) DO NOTHING`,
            [String(normalizedLog.id).trim(), JSON.stringify(getDocumentPayload(normalizedLog))]
          );
          count += result.rowCount || 0;
        }
        return count;
      });
      res.status(201).json({ inserted });
    } catch (error: any) {
      console.error("PostgreSQL activity log batch write error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.get("/api/db-meta", async (req, res) => {
    const rawNames = String(req.query.collections || "").split(",").map(s => s.trim()).filter(Boolean);
    const names = Array.from(new Set(rawNames)).filter(n => DB_COLLECTIONS.has(n));
    if (names.length === 0) {
      res.json({ meta: {} });
      return;
    }
    try {
      const result = await pool.query(
        `SELECT collection_name, COUNT(*)::int AS count, MAX(updated_at) AS max_updated_at
         FROM app_documents
         WHERE collection_name = ANY($1::text[])
         GROUP BY collection_name`,
        [names]
      );
      const meta: Record<string, { count: number; maxUpdatedAt: string | null }> = {};
      for (const name of names) {
        meta[name] = { count: 0, maxUpdatedAt: null };
      }
      for (const row of result.rows) {
        meta[row.collection_name] = {
          count: row.count,
          maxUpdatedAt: row.max_updated_at ? new Date(row.max_updated_at).toISOString() : null,
        };
      }
      res.json({ meta });
    } catch (error: any) {
      console.error("PostgreSQL collection meta read error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.get("/api/db/:collection", async (req, res) => {
    const collectionName = getDbCollection(req, res);
    if (!collectionName) return;
    try {
      const result = await pool.query(
        `SELECT document_id, data
         FROM app_documents
         WHERE collection_name = $1
         ORDER BY updated_at DESC, document_id ASC`,
        [collectionName]
      );
      res.json({ items: result.rows.map(mapDocumentRow) });
    } catch (error: any) {
      console.error(`PostgreSQL read error for ${collectionName}:`, error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.put("/api/db/:collection/:id", async (req, res) => {
    const collectionName = getDbCollection(req, res);
    if (!collectionName) return;
    const documentId = decodeURIComponent(String(req.params.id || ""));
    if (!documentId.trim()) {
      res.status(400).json({ error: "Thiếu document id" });
      return;
    }
    try {
      const result = await pool.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
         RETURNING document_id, data`,
        [collectionName, documentId, JSON.stringify(getDocumentPayload(req.body))]
      );
      res.json(mapDocumentRow(result.rows[0]));
    } catch (error: any) {
      console.error(`PostgreSQL write error for ${collectionName}/${documentId}:`, error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.delete("/api/db/:collection/:id", async (req, res) => {
    const collectionName = getDbCollection(req, res);
    if (!collectionName) return;
    const documentId = decodeURIComponent(String(req.params.id || ""));
    try {
      const result = await pool.query(
        "DELETE FROM app_documents WHERE collection_name = $1 AND document_id = $2",
        [collectionName, documentId]
      );
      res.json({ deleted: result.rowCount || 0, id: documentId });
    } catch (error: any) {
      console.error(`PostgreSQL delete error for ${collectionName}/${documentId}:`, error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.post("/api/db/:collection/batch", async (req, res) => {
    const collectionName = getDbCollection(req, res);
    if (!collectionName) return;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length > 250) {
      res.status(400).json({ error: "Mỗi lần batch chỉ được tối đa 250 document" });
      return;
    }
    try {
      const saved = await withPgTransaction(async (client) => {
        for (const item of items) {
          const documentId = String(item?.id || "").trim();
          if (!documentId) continue;
          await client.query(
            `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
             VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (collection_name, document_id)
             DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
            [collectionName, documentId, JSON.stringify(getDocumentPayload(item?.data))]
          );
        }
        return items.length;
      });
      res.json({ saved });
    } catch (error: any) {
      console.error(`PostgreSQL batch write error for ${collectionName}:`, error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.post("/api/db/:collection/delete-batch", async (req, res) => {
    const collectionName = getDbCollection(req, res);
    if (!collectionName) return;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : [];
    if (ids.length > 250) {
      res.status(400).json({ error: "Mỗi lần batch chỉ được tối đa 250 document" });
      return;
    }
    try {
      const result = await pool.query(
        "DELETE FROM app_documents WHERE collection_name = $1 AND document_id = ANY($2::text[])",
        [collectionName, ids]
      );
      res.json({ deleted: result.rowCount || 0 });
    } catch (error: any) {
      console.error(`PostgreSQL batch delete error for ${collectionName}:`, error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.get("/api/backups", requireAdmin, async (req, res) => {
    try {
      const [items, pgToolAvailable] = await Promise.all([
        Promise.resolve(listBackups()),
        isPgToolAvailable(),
      ]);
      res.json({ items, pgToolAvailable });
    } catch (error: any) {
      console.error("List backups error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.post("/api/backups/run", requireAdmin, async (req, res) => {
    try {
      if (!(await isPgToolAvailable())) {
        res.status(503).json({ error: "pg_dump chưa được cài đặt trên máy chủ. Vui lòng cài PostgreSQL client tools." });
        return;
      }
      const backup = await createBackup("manual");
      applyRetention(Number(process.env.BACKUP_RETENTION_COUNT || 14));
      res.json(backup);
    } catch (error: any) {
      console.error("Manual backup error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.get("/api/backups/:filename/download", requireAdmin, async (req, res) => {
    try {
      const filePath = getBackupPath(String(req.params.filename || ""));
      res.download(filePath);
    } catch (error: any) {
      console.error("Backup download error:", error);
      res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.post("/api/backups/:filename/restore", requireAdmin, async (req, res) => {
    const filename = String(req.params.filename || "");
    if (req.body?.confirm !== "KHOIPHUC") {
      res.status(400).json({ error: "Thiếu xác nhận khôi phục." });
      return;
    }
    try {
      if (!(await isPgToolAvailable())) {
        res.status(503).json({ error: "pg_restore chưa được cài đặt trên máy chủ. Vui lòng cài PostgreSQL client tools." });
        return;
      }
      await restoreBackup(filename);
      res.json({ restored: filename });
    } catch (error: any) {
      console.error("Backup restore error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.delete("/api/backups/:filename", requireAdmin, async (req, res) => {
    try {
      deleteBackup(String(req.params.filename || ""));
      res.json({ deleted: req.params.filename });
    } catch (error: any) {
      console.error("Backup delete error:", error);
      res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.get('/api/tieuchuan', (req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'public', 'tieuchuan.xlsx');
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found', data: [] });
      }
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      const standards = rows
        .map((row) => row[0])
        .filter((item) => typeof item === 'string' && item.trim().length > 0);
      return res.json({ data: standards });
    } catch (error) {
      console.error('Error reading tieuchuan.xlsx:', error);
      return res.status(500).json({ error: 'Failed to read standards', data: [] });
    }
  });

  // --- DOCX Templates Management APIs ---
  app.get("/api/templates", (req, res) => {
    try {
      const publicDir = path.join(process.cwd(), "public");
      const distDir = path.join(process.cwd(), "dist");

      const items: ReportTemplateMetadata[] = REPORT_TEMPLATES_CATALOG.map((tpl) => {
        let filePath = path.join(publicDir, tpl.filename);
        if (!fs.existsSync(filePath) && fs.existsSync(path.join(distDir, tpl.filename))) {
          filePath = path.join(distDir, tpl.filename);
        }

        const exists = fs.existsSync(filePath);
        let size = 0;
        let updatedAt = "";

        if (exists) {
          try {
            const stats = fs.statSync(filePath);
            size = stats.size;
            updatedAt = stats.mtime.toISOString();
          } catch {
            // ignore stat errors
          }
        }

        const bakPath = path.join(publicDir, `${tpl.filename}.bak`);
        const defaultBakPath = tpl.defaultBackupFilename ? path.join(publicDir, tpl.defaultBackupFilename) : null;
        const hasBackup = fs.existsSync(bakPath) || (defaultBakPath ? fs.existsSync(defaultBakPath) : false);

        return {
          ...tpl,
          size,
          updatedAt,
          exists,
          hasBackup,
        };
      });

      res.json({ success: true, data: items });
    } catch (error: any) {
      console.error("Error fetching templates metadata:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:filename/download", (req, res) => {
    try {
      const rawFilename = decodeURIComponent(req.params.filename || "");
      const safeFilename = path.basename(rawFilename);
      if (!safeFilename || !safeFilename.endsWith(".docx")) {
        return res.status(400).json({ error: "Invalid docx filename" });
      }

      let filePath = path.join(process.cwd(), "public", safeFilename);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), "dist", safeFilename);
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Template file not found" });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeFilename)}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.sendFile(filePath);
    } catch (error: any) {
      console.error("Error downloading template:", error);
      res.status(500).json({ error: error?.message || "Failed to download template" });
    }
  });

  app.post("/api/templates/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      const targetFilename = String(req.body.filename || "").trim();
      const safeFilename = path.basename(targetFilename);

      if (!file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }
      if (!safeFilename || !safeFilename.endsWith(".docx")) {
        return res.status(400).json({ success: false, error: "Target filename must be a valid .docx file" });
      }

      const catalogItem = REPORT_TEMPLATES_CATALOG.find((t) => t.filename === safeFilename);
      if (!catalogItem) {
        return res.status(400).json({ success: false, error: "Filename is not in the system templates catalog" });
      }

      const publicDir = path.join(process.cwd(), "public");
      const distDir = path.join(process.cwd(), "dist");
      const targetPublicPath = path.join(publicDir, safeFilename);
      const targetDistPath = path.join(distDir, safeFilename);

      const bakPath = path.join(publicDir, `${safeFilename}.bak`);
      if (fs.existsSync(targetPublicPath) && !fs.existsSync(bakPath)) {
        try {
          fs.copyFileSync(targetPublicPath, bakPath);
        } catch (bakErr) {
          console.warn("Could not create .bak backup for template:", bakErr);
        }
      }

      fs.writeFileSync(targetPublicPath, file.buffer);

      if (fs.existsSync(distDir)) {
        try {
          fs.writeFileSync(targetDistPath, file.buffer);
        } catch {
          // ignore dist sync error if any
        }
      }

      const stats = fs.statSync(targetPublicPath);

      return res.json({
        success: true,
        message: `Đã cập nhật biểu mẫu ${safeFilename} thành công!`,
        data: {
          filename: safeFilename,
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Error uploading template:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to update template" });
    }
  });

  app.post("/api/templates/:filename/reset", async (req, res) => {
    try {
      const rawFilename = decodeURIComponent(req.params.filename || "");
      const safeFilename = path.basename(rawFilename);
      if (!safeFilename || !safeFilename.endsWith(".docx")) {
        return res.status(400).json({ success: false, error: "Invalid docx filename" });
      }

      const catalogItem = REPORT_TEMPLATES_CATALOG.find((t) => t.filename === safeFilename);
      if (!catalogItem) {
        return res.status(400).json({ success: false, error: "Filename is not in the system templates catalog" });
      }

      const publicDir = path.join(process.cwd(), "public");
      const distDir = path.join(process.cwd(), "dist");
      const targetPublicPath = path.join(publicDir, safeFilename);
      const targetDistPath = path.join(distDir, safeFilename);

      const bakPath = path.join(publicDir, `${safeFilename}.bak`);
      const defaultBakPath = catalogItem.defaultBackupFilename ? path.join(publicDir, catalogItem.defaultBackupFilename) : null;

      let sourcePath: string | null = null;
      if (fs.existsSync(bakPath)) {
        sourcePath = bakPath;
      } else if (defaultBakPath && fs.existsSync(defaultBakPath)) {
        sourcePath = defaultBakPath;
      }

      if (!sourcePath) {
        return res.status(404).json({ success: false, error: "Không tìm thấy bản lưu gốc để khôi phục" });
      }

      fs.copyFileSync(sourcePath, targetPublicPath);
      if (fs.existsSync(distDir)) {
        try {
          fs.copyFileSync(sourcePath, targetDistPath);
        } catch {
          // ignore dist copy
        }
      }

      const stats = fs.statSync(targetPublicPath);

      return res.json({
        success: true,
        message: `Đã khôi phục biểu mẫu gốc ${safeFilename}!`,
        data: {
          filename: safeFilename,
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Error resetting template:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to reset template" });
    }
  });

  app.get("/api/gemini/models", async (req, res) => {
    try {
      const activeAi = getGeminiClient(req);
      const response = await activeAi.models.list();
      const rawModels: any[] = [];
      
      if (response && typeof (response as any)[Symbol.asyncIterator] === "function") {
        for await (const model of response as any) {
          rawModels.push(model);
        }
      } else if (Array.isArray((response as any)?.models)) {
        rawModels.push(...(response as any).models);
      } else if (Array.isArray(response)) {
        rawModels.push(...response);
      }

      const models = rawModels
        .filter((m: any) => {
          const name = (m.name || m.id || "").toLowerCase();
          const methods = m.supportedGenerationMethods || m.supportedActions || [];
          const isGemini = name.includes("gemini");
          const canGenerate = methods.length === 0 || methods.includes("generateContent");
          return isGemini && canGenerate;
        })
        .map((m: any) => {
          const id = (m.name || m.id || "").replace(/^models\//, "");
          return {
            id,
            name: m.name || id,
            displayName: m.displayName || id,
            description: m.description || "",
            inputTokenLimit: m.inputTokenLimit,
            outputTokenLimit: m.outputTokenLimit,
            supportedGenerationMethods: m.supportedGenerationMethods || [],
          };
        });

      res.json({ models, count: models.length });
    } catch (error: any) {
      if (error?.message === GEMINI_API_KEY_MISSING_MESSAGE) {
        res.status(503).json({
          code: "GEMINI_API_KEY_MISSING",
          error: GEMINI_API_KEY_MISSING_MESSAGE,
        });
        return;
      }
      if (isGeminiUpstreamUnavailable(error)) {
        res.status(503).json({
          code: GEMINI_API_UPSTREAM_UNAVAILABLE_CODE,
          error: GEMINI_API_UPSTREAM_UNAVAILABLE_MESSAGE,
        });
        return;
      }
      console.error("Lỗi lấy danh sách mô hình Gemini:", error);
      res.status(500).json({ error: error.message || "Lỗi lấy danh sách mô hình từ Google" });
    }
  });

  app.post("/api/gemini/extract-requests", async (req, res) => {
    try {
      const { files, refBrands, refCustomers, refProducts } = req.body;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "Không tìm thấy file gửi lên" });
      }

      const brandsList = (refBrands || []).join(", "); 
      const customersList = (refCustomers || []).map((c: any) => `"${c.name}"`).join(",\n");
      const productsList = (refProducts || []).length > 0 
        ? (refProducts || []).join(", ") 
        : "Điều hòa không khí, Tủ lạnh, Máy giặt, Máy nước nóng, Lò vi sóng, Nồi cơm điện, Tivi, Bóng đèn, Quạt điện";

      const prompt = `
        Bạn là trợ lý nhập liệu thông minh cho Kho hàng của phòng Điện - Điện tử.
        Nhiệm vụ: Trích xuất thông tin Giao/Nhận hàng từ hình ảnh (Phiếu giao hàng, Packing List, Hóa đơn, hoặc ảnh chụp tem máy/thùng máy).

        === LOGIC PHÂN LOẠI TÊN MẪU / LOẠI MÁY (type) ===
        Hãy tìm tên loại sản phẩm hoặc tên thiết bị phù hợp nhất trong danh sách sản phẩm sau: [${productsList}].
        Chú ý so sánh từ đồng nghĩa (ví dụ: "bếp từ" -> "Bếp điện từ").
        TUYỆT ĐỐI CẤM tự động gán là "Nồi cơm điện" nếu tài liệu không ghi rõ.
        Nếu sản phẩm không có sự tương đồng nào với danh sách trên, hãy trích xuất CHÍNH XÁC tên loại sản phẩm thực tế được ghi trên chứng từ (ví dụ: "Bếp hồng ngoại đơn", "Máy làm sữa hạt").
        Nếu tài liệu không ghi rõ tên sản phẩm, hãy trả về chuỗi rỗng (""), tuyệt đối không được đoán mò hay mặc định là "Nồi cơm điện" hoặc các loại máy khác.

        === DỮ LIỆU THAM KHẢO ===
        Nhãn hiệu: ${brandsList}
        Khách hàng: ${customersList}

        === YÊU CẦU XỬ LÝ ===
        1. KHÁCH HÀNG: Tìm tên đơn vị gửi/nhận, địa chỉ, sdt, mã số thuế.
           - Đặc biệt tìm tên "Người liên hệ" hoặc "Người đại diện" (contact person).
           - Đối chiếu danh sách tham khảo để lấy tên khách hàng chuẩn xác nhất.
           - Trích xuất "senderUnit" (Đơn vị gửi mẫu thử / Đơn vị yêu cầu thử nghiệm) nếu có ghi rõ trên phiếu/giấy tờ. Nếu không rõ hoặc không có, gán giống như tên Khách hàng (name).
        2. DANH SÁCH HÀNG (QUAN TRỌNG):
           - Tìm tất cả các dòng Model/Sản phẩm trong ảnh.
           - Nếu là ảnh chụp nhiều thùng hàng giống nhau, hãy đếm số lượng thùng để suy ra "quantity".
           - Nếu là văn bản (list), hãy lấy số lượng từ cột Số lượng.
           - "specifications": Trích xuất Điện áp, Gas, Công suất.
           - "standard": Trích xuất thông tin Tiêu chuẩn thử nghiệm / Tiêu chuẩn áp dụng (nếu có).
           - "testCriteria": Trích xuất thông tin Chỉ tiêu thử nghiệm / Hạng mục thử nghiệm (nếu có).
        3. TỰ ĐỘNG NHẬN DIỆN TEM NIÊM PHONG (CỰC KỲ QUAN TRỌNG):
           - Hãy quét thật kỹ tài liệu/hình ảnh xem có xuất hiện thông tin tem niêm phong có tiền tố "IEMM" (Ví dụ: "IEMM...", "IEMM....", "IEMM.26/...", "IEMM/...", "IEMM-...", "IEMM xxxx") hay không. MỌI MÃ BẮT ĐẦU BẰNG TIỀN TỐ "IEMM" DƯỚI BẤT KỲ ĐỊNH DẠNG NÀO ĐỀU LÀ SỐ TEM NIÊM PHONG.
           - TUYỆT ĐỐI CẤM TỰ SUY DIỄN, ĐOÁN HOẶC BỊA RA MÃ TEM NIÊM PHONG NẾU KHÔNG CÓ TRÊN TÀI LIỆU/HÌNH ẢNH. NẾU KHÔNG THẤY THÌ BẮT BUỘC TRẢ VỀ CHUỒI RỖNG "".
           - TUYỆT ĐỐI CẤM sử dụng các ví dụ như "IEMM.26/HQA/1291.2A-SP" làm giá trị trả về nếu tài liệu thực tế không có mã này.
           - Nếu thấy mã thực tế, hãy lấy toàn bộ mã số tem niêm phong đó. CHÚ Ý QUAN TRỌNG: NẾU mã có hậu tố mẫu thử bắt đầu bằng chữ M (Ví dụ: "-M01", "-M02") thì mới loại bỏ hậu tố đó (Ví dụ: "IEMM.26/HQA/1291.2A-SP-M01" thành "IEMM.26/HQA/1291.2A-SP"). NẾU hậu tố KHÔNG BẮT ĐẦU bằng chữ M (Ví dụ: "-01" trong "IEMM.26/EMC/0403-SP-01" hoặc "IEMM....") thì KHÔNG ĐƯỢC CẮT, phải giữ nguyên toàn bộ chuỗi.
           - Trả về chuỗi kết quả này trong trường "sealStamp" ở cấp ngoài cùng của JSON.
        4. NHẬN DIỆN PHÒNG / LOẠI THỬ NGHIỆM (testCategories):
           - Phân tích kỹ tiêu đề, nội dung, tiêu chuẩn (standard), chỉ tiêu (testCriteria), tên phòng thử nghiệm hoặc các từ khóa trong tài liệu cho từng mẫu.
           - Quy tắc:
             + Nếu tài liệu/mẫu ghi nhận là Tương thích điện từ / EMC (TCVN 7492, QCVN 9, nhiễu điện từ, EMC...): trả về ["EMC"].
             + Nếu tài liệu/mẫu ghi nhận là An toàn điện hoặc ITD (TCVN 5699, TCVN 7898, QCVN 4, QCVN 04, An toàn điện, ATD, ITD...): trả về ["ITD"].
             + ĐẶC BIỆT: Nếu tài liệu ghi nhận CẢ An toàn điện VÀ EMC: trả về ["EMC", "ITD"], tuyệt đối KHÔNG chứa "ITDC".
             + Nếu tài liệu/mẫu ghi rõ đích danh phòng/thử nghiệm ITDC: trả về ["ITDC"].
             + Nếu KHÔNG nhận diện được hoặc tài liệu KHÔNG ghi rõ thông tin thử nghiệm: trả về mảng rỗng [] (TUYỆT ĐỐI KHÔNG tự động gán hay đoán mặc định là ITDC hay bất kỳ loại nào).
        5. THÔNG TIN CHUNG KHÁC:
           - "Tình trạng mẫu" (sampleCondition): Nếu có ghi, trả về "Mới" hoặc "Cũ" (Đã sử dụng).
           - "Xử lý sau thử nghiệm" (postTestHandling): Nếu có ghi, trả về "Lưu mẫu", "Hủy", hoặc "Nhận lại".
           - "Số lượng bản sao" (resultCopyCount): Tìm thông tin số lượng bản kết quả/báo cáo được yêu cầu cung cấp (là kiểu số nguyên, ví dụ: 1, 2, 3...).

        === ĐỊNH DẠNG JSON TRẢ VỀ ===
        {
          "customerInfo": { 
              "name": "...", 
              "senderUnit": "...",
              "address": "...", 
              "phone": "...", 
              "taxId": "...", 
              "contactPerson": "..." 
          },
          "sealStamp": "BẮT BUỘC TRẢ VỀ CHUỖI RỖNG '' NẾU KHÔNG THẤY MÃ TEM TRONG TÀI LIỆU. TUYỆT ĐỐI KHÔNG TỰ BỊA MÃ.",
          "sampleCondition": "Mới",
          "postTestHandling": "Lưu mẫu",
          "resultCopyCount": 2,
          "samples": [
            { 
              "modelName": "Mã model", 
              "brand": "Tên hãng", 
              "type": "Tên mẫu/Loại máy", 
              "quantity": 1, 
              "specifications": "...",
              "standard": "...",
              "testCriteria": "...",
              "testCategories": ["EMC", "ITD"]
            }
          ]
        }
      `;

      let detectedSealStamp = "";
      const parts: any[] = [{ text: prompt }];
      for (const file of (files || [])) {
        if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || (typeof file.mimeType === "string" && file.mimeType.includes("word"))) {
          try {
            const buffer = Buffer.from(file.data, "base64");
            const docxResult = await mammoth.extractRawText({ buffer });
            const docxText = docxResult.value;
            parts.push({ text: `[Nội dung trích xuất từ file Word]:\n${docxText}` });

            const docxMatch = docxText.match(/IEMM[\.\/\-\s\w]+/i) || docxText.match(/IEMM[A-Za-z0-9._\-\/]+/i);
            if (docxMatch) {
              detectedSealStamp = docxMatch[0].replace(/-M\d+$/i, '').trim().toUpperCase();
            }
          } catch (docxErr: any) {
            console.error("Lỗi đọc file DOCX qua mammoth:", docxErr);
            parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
          }
        } else {
          parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        }
      }

      const activeAi = getGeminiClient(req);
      const preferredModel = req.headers["x-gemini-model"] as string | undefined;
      const response = await generateContentWithRetryAndFallback(activeAi, {
        contents: { parts: parts },
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customerInfo: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  senderUnit: { type: Type.STRING },
                  address: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  taxId: { type: Type.STRING },
                  contactPerson: { type: Type.STRING }
                }
              },
              sealStamp: { type: Type.STRING },
              sampleCondition: { type: Type.STRING },
              postTestHandling: { type: Type.STRING },
              resultCopyCount: { type: Type.INTEGER },
              samples: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    modelName: { type: Type.STRING },
                    brand: { type: Type.STRING },
                    type: { type: Type.STRING },
                    quantity: { type: Type.INTEGER },
                    specifications: { type: Type.STRING },
                    standard: { type: Type.STRING },
                    testCriteria: { type: Type.STRING },
                    testCategories: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Loại thử nghiệm/phòng thử nghiệm được trích xuất: ['EMC'], ['ITD'], ['EMC', 'ITD'], ['ITDC'], hoặc []"
                    }
                  }
                }
              }
            }
          }
        }
      }, preferredModel);

      const text = response.text;
      if (!text) throw new Error("AI không trả về kết quả");
      
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      console.log('AI Output:', cleanedText);
      const parsed = JSON.parse(cleanedText);

      if (parsed.sealStamp) {
        const cleanSeal = parsed.sealStamp.trim().replace(/-M\d+$/i, '').toUpperCase();
        if (
          cleanSeal === "IEMM.26/HQA/1291.2A-SP" ||
          cleanSeal === "IEMM.26/EMC/0403-SP-01" ||
          cleanSeal.includes("VÍ DỤ") ||
          cleanSeal.includes("VIDU") ||
          cleanSeal.includes("EXAMPLE") ||
          cleanSeal.includes("KHÔNG THẤY") ||
          cleanSeal.includes("KHONGTHAY") ||
          cleanSeal.includes("NULL") ||
          cleanSeal.includes("UNDEFINED")
        ) {
          parsed.sealStamp = "";
        } else {
          parsed.sealStamp = cleanSeal;
        }
      } else {
        parsed.sealStamp = "";
      }

      if (detectedSealStamp && !parsed.sealStamp) {
        parsed.sealStamp = detectedSealStamp;
      }

      res.json(parsed);
    } catch (error: any) {
      console.error("Gemini Extraction Error:", error);
      let errMsg = error.message || "Lỗi trích xuất AI";
      if (typeof errMsg === "string" && (errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE"))) {
        errMsg = "Máy chủ AI hiện đang quá tải. Hệ thống đã tự động thử lại nhưng chưa thành công. Vui lòng thử lại sau giây lát.";
      }
      res.status(500).json({ error: errMsg });
    }
  });

  app.post("/api/gemini/extract-results", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: "Thiếu dữ liệu file" });
      }

      const prompt = `
          Phân tích báo cáo thử nghiệm của phòng Điện - Điện tử. Hãy trích xuất các thông tin sau:
          - "serialNumber": Số Serial của máy thử nghiệm.
          - "measuredCapacity": Công suất lạnh định mức (W) đo được. Nếu đơn vị BTU/h hãy đổi sang W (BTU/3.412).
          - "measuredPower": Công suất điện tiêu thụ (W) đo được.
          - "cspf": Chỉ số hiệu suất năng lượng CSPF.
          - "energyLevel": Cấp sao năng lượng đạt được (từ 1 đến 5).
          Trả về kết quả dưới định dạng JSON khớp chính xác các trường trên.
      `;

      const activeAi = getGeminiClient(req);
      const preferredModel = req.headers["x-gemini-model"] as string | undefined;
      const response = await generateContentWithRetryAndFallback(activeAi, {
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } },
            { text: prompt }
          ]
        },
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              serialNumber: { type: Type.STRING },
              measuredCapacity: { type: Type.NUMBER },
              measuredPower: { type: Type.NUMBER },
              cspf: { type: Type.NUMBER },
              energyLevel: { type: Type.NUMBER }
            }
          }
        }
      }, preferredModel);

      const text = response.text;
      if (!text) throw new Error("AI không trả về kết quả");
      
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      console.log('AI Output:', cleanedText);
      const parsed = JSON.parse(cleanedText);
      res.json(parsed);
    } catch (error: any) {
      console.error("Gemini Result Extraction Error:", error);
      let errMsg = error.message || "Lỗi trích xuất kết quả";
      if (typeof errMsg === "string" && (errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE"))) {
        errMsg = "Máy chủ AI hiện đang quá tải. Hệ thống đã tự động thử lại nhưng chưa thành công. Vui lòng thử lại sau giây lát.";
      }
      res.status(500).json({ error: errMsg });
    }
  });


  app.post("/api/gemini/extract-kqtn-metadata", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body || {};
      if (!base64Data) {
        res.status(400).json({ error: "Missing PDF data." });
        return;
      }
      const activeAi = getGeminiClient(req);
      const preferredModel = req.headers["x-gemini-model"] as string | undefined;
      const prompt = `
Bạn đang xem trang bìa (trang 1) của một báo cáo/phiếu kết quả thử nghiệm thuộc phòng Điện - Điện tử, có thể là bản scan chất lượng thấp, có dấu mộc, chữ viết tay hoặc bảng biểu chồng lên nhau.

Hãy đọc kỹ toàn bộ trang và trích xuất chính xác ba trường sau:
- "sampleCode": Số mã hóa/mã hiệu của mẫu thử (thường xuất hiện gần nhãn "Số mã hóa", "Mã mẫu", "Mã hiệu", "Encode No.", "Sample code", có thể là chuỗi số-chữ có dấu gạch ngang hoặc chấm). Ưu tiên giá trị được đóng dấu hoặc in đậm/khung nếu có nhiều số xuất hiện.
- "model": Model/ký hiệu sản phẩm (nhãn "Model", "Kiểu loại", "Type").
- "brand": Tên hãng/nhãn hiệu sản xuất (nhãn "Hãng sản xuất", "Nhãn hiệu", "Manufacturer", "Brand").

Quy tắc bắt buộc:
1. Chỉ lấy giá trị thực sự nhìn thấy trên trang; tuyệt đối không suy đoán, không tự bịa, không lấy từ kiến thức ngoài tài liệu.
2. Giữ nguyên định dạng gốc của mã (chữ hoa/thường, dấu gạch ngang, khoảng trắng) như in trên phiếu, không tự chuẩn hóa.
3. Nếu một trường không xuất hiện trên trang hoặc không đọc rõ, trả về chuỗi rỗng "" cho trường đó thay vì đoán.
4. Nếu có nhiều mã số nghi ngờ là sampleCode, chọn mã gắn với nhãn ghi rõ ràng nhất; không chọn số phiếu/số báo cáo (report No.) làm sampleCode trừ khi không có mã nào khác.

Trả về đúng định dạng JSON khớp schema đã cung cấp.
`;
      const response = await generateContentWithRetryAndFallback(activeAi, {
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } },
            { text: prompt },
          ],
        },
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sampleCode: { type: Type.STRING },
              model: { type: Type.STRING },
              brand: { type: Type.STRING },
            },
          },
        },
      }, preferredModel);
      const text = response.text;
      if (!text) throw new Error("AI returned no metadata.");
      const cleanedText = text.split(String.fromCharCode(96)).join("").trim();
      res.json(JSON.parse(cleanedText));
    } catch (error: any) {
      console.error("KQTN metadata extraction error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.post("/api/gemini/extract-kqtn-bulk-structure", async (req, res) => {
    try {
      const { base64Data, pageOffset } = req.body || {};
      if (!base64Data) {
        res.status(400).json({ error: "Missing PDF batch data." });
        return;
      }
      const parsedOffset = Number(pageOffset);
      const safeOffset = Number.isFinite(parsedOffset) ? Math.max(0, Math.floor(parsedOffset)) : 0;
      const activeAi = getGeminiClient(req);
      const preferredModel = req.headers["x-gemini-model"] as string | undefined;
      const prompt = `
Bạn đang xem một batch PDF gồm nhiều trang liên tiếp của một hoặc nhiều báo cáo kết quả thử nghiệm Điện - Điện tử.
Hãy kiểm tra từng trang trong batch và trả về đúng một phần tử cho mỗi trang, theo thứ tự trang.

Quy tắc nhận diện:
- pageNumber là số trang cục bộ trong batch, bắt đầu từ 1.
- isReportCover=true chỉ khi trang có dấu hiệu rõ ràng là trang bìa báo cáo: tiêu đề báo cáo/phiếu kết quả, số báo cáo, mã hóa mẫu hoặc bảng thông tin mẫu. Không suy đoán từ một trang dữ liệu đơn lẻ.
- isBlank=true chỉ khi trang trắng hoặc gần như trắng. Không đánh dấu trang phân cách nằm giữa nội dung là blank nếu trang đó có nội dung đáng kể.
- reportNo là số báo cáo/phiếu nếu nhìn rõ; không dùng số báo cáo để thay thế sampleCode.
- sampleCode là số mã hóa/mã hiệu mẫu nếu nhìn rõ.
- model, brand, sealStamp, sampleName chỉ lấy giá trị nhìn thấy trên trang bìa; trường không rõ trả chuỗi rỗng.
- Không bịa dữ liệu và không dùng kiến thức ngoài tài liệu.

Trả về JSON theo schema đã cung cấp, không thêm markdown.
`;
      const response = await generateContentWithRetryAndFallback(activeAi, {
        contents: {
          parts: [
            { inlineData: { mimeType: "application/pdf", data: base64Data } },
            { text: prompt },
          ],
        },
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageNumber: { type: Type.INTEGER },
                    isReportCover: { type: Type.BOOLEAN },
                    isBlank: { type: Type.BOOLEAN },
                    reportNo: { type: Type.STRING },
                    sampleCode: { type: Type.STRING },
                    model: { type: Type.STRING },
                    brand: { type: Type.STRING },
                    sealStamp: { type: Type.STRING },
                    sampleName: { type: Type.STRING },
                  },
                  required: ["pageNumber", "isReportCover", "isBlank", "reportNo", "sampleCode", "model", "brand", "sealStamp", "sampleName"],
                },
              },
            },
            required: ["pages"],
          },
        },
      }, preferredModel);
      const text = response.text;
      if (!text) throw new Error("AI returned no PDF structure.");
      const cleanedText = text.split(String.fromCharCode(96)).join("").trim();
      const parsed = JSON.parse(cleanedText);
      const pages = Array.isArray(parsed.pages) ? parsed.pages.map((page: any, index: number) => ({
        pageNumber: safeOffset + Math.max(1, Math.floor(Number(page?.pageNumber) || index + 1)),
        isReportCover: Boolean(page?.isReportCover),
        isBlank: Boolean(page?.isBlank),
        reportNo: String(page?.reportNo || "").trim(),
        sampleCode: String(page?.sampleCode || "").trim(),
        model: String(page?.model || "").trim(),
        brand: String(page?.brand || "").trim(),
        sealStamp: String(page?.sealStamp || "").trim(),
        sampleName: String(page?.sampleName || "").trim(),
      })) : [];
      res.json({ pages });
    } catch (error: any) {
      console.error("KQTN bulk structure extraction error:", error);
      res.status(500).json({ error: error?.message || String(error) });
    }
  });

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, history, appContext } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Thiếu câu hỏi người dùng" });
      }

      const systemInstruction = `
Bạn là Trợ lý AI chuyên nghiệp, nhiệt tình của phòng Điện - Điện tử.
Nhiệm vụ của bạn là hỗ trợ các Kỹ thuật viên (KTV), Quản lý, và Khách hàng trong việc tra cứu thông tin phiếu yêu cầu, tình trạng mẫu thử và giải đáp các thắc mắc về kỹ thuật hay tiêu chuẩn điện.

=== DỮ LIỆU THỜI GIAN THỰC CỦA PHÒNG LAB ===
Dưới đây là thông tin hiện tại từ hệ thống phòng Lab để bạn tham khảo giải quyết câu hỏi:
${appContext || "Chưa có thông tin hoặc hệ thống đang trống."}

=== QUY TẮC TRẢ LỜI ===
1. Hãy giao tiếp bằng tiếng Việt chuẩn mực, thân thiện, rõ ràng, có cấu trúc tốt.
2. Dùng dữ liệu thời gian thực được cung cấp để trả lời các yêu cầu tra cứu của người dùng về Số phiếu, Model sản phẩm, hoặc Tem niêm phong. Khi tìm thấy thông tin, hãy cung cấp rõ ràng: 
   - Số phiếu, Model, Tên mẫu, Khách hàng.
   - Trạng thái xử lý và Lịch thử nghiệm.
   - Kỹ thuật viên phụ trách.
   - Mã hóa mẫu thử.
3. Nếu không tìm thấy thông tin phù hợp, hãy thông báo rõ ràng là không tìm thấy và đề nghị người dùng kiểm tra lại mã hoặc thông tin tra cứu.
4. Trả lời bằng Markdown rõ ràng, dùng tiêu đề (h3), in đậm để phân chia thông tin và tạo sự chuyên nghiệp. Tránh trả lời quá dài dòng nhưng phải đủ chi tiết.
`;

      const formattedHistory = (history || []).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const activeAi = getGeminiClient(req);
      const preferredModel = req.headers["x-gemini-model"] as string | undefined;

      const response = await createChatWithRetryAndFallback(activeAi, {
        config: {
          systemInstruction,
          temperature: 0.7,
        },
        history: formattedHistory
      }, message, preferredModel);
      
      const text = response.text || "";
      res.json({ response: text });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/extract-radimation", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const zip = new AdmZip(req.file.buffer);
      const docXmlEntry = zip.getEntries().find(e => e.entryName === "word/document.xml");
      const relsXmlEntry = zip.getEntries().find(e => e.entryName === "word/_rels/document.xml.rels");
      
      let tableData: any[] = [];
      let tablePhaseL: any[] = [];
      let tablePhaseN: any[] = [];
      let tablePower: any[] = [];
      let info: Record<string, string> = {};
      let images: Record<string, string> = {};
      let phaseLFound = false;
      let phaseNFound = false;

      function detectMediaType(buf: Buffer, filename = ""): "png" | "jpeg" | "gif" | "bmp" | "emf" | "wmf" | "unknown" {
        if (!buf || buf.length < 4) return "unknown";
        if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
          return "png";
        }
        if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
          return "jpeg";
        }
        if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
          return "gif";
        }
        if (buf[0] === 0x42 && buf[1] === 0x4D) {
          return "bmp";
        }
        if (buf.length > 44 && buf[0] === 1 && buf[1] === 0 && buf[2] === 0 && buf[3] === 0 &&
            buf[40] === 0x20 && buf[41] === 0x45 && buf[42] === 0x4D && buf[43] === 0x46) {
          return "emf";
        }
        if (buf.length > 4 && buf[0] === 0xD7 && buf[1] === 0xCD && buf[2] === 0xC6 && buf[3] === 0x9A) {
          return "wmf";
        }
        if (buf.length > 4 && (buf[0] === 0x01 || buf[0] === 0x02) && buf[1] === 0x00 && buf[2] === 0x09 && buf[3] === 0x00) {
          return "wmf";
        }
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        if (ext === "emf") return "emf";
        if (ext === "wmf") return "wmf";
        if (ext === "png") return "png";
        if (ext === "jpg" || ext === "jpeg") return "jpeg";
        return "unknown";
      }

      async function renderCompositeVectorLayers(entries: any[]): Promise<string | null> {
        if (!entries || entries.length === 0) return null;
        try {
          let masterWidth = "";
          let masterHeight = "";
          let masterViewBox = "";
          const combinedSvgLayers: string[] = [];
          let convertedLayerCount = 0;
          const failedLayerIndexes: number[] = [];

          for (let idx = 0; idx < entries.length; idx++) {
            try {
              const entry = entries[idx];
              const rawBuf = entry.getData();
              if (!rawBuf || rawBuf.length === 0) {
                failedLayerIndexes.push(idx);
                continue;
              }

              const mediaType = detectMediaType(rawBuf, entry.entryName);
              const kind = mediaType === "wmf" ? "wmf" : "emf";
              const data = new Uint8Array(rawBuf);
              const convertToSvg = await getEmfOrWmfToSvg();
              let svg = await convertToSvg(kind as any, data, 96);
              if (!svg || typeof svg !== "string" || svg.length < 30 || !svg.includes("<svg")) {
                failedLayerIndexes.push(idx);
                continue;
              }

              svg = svg.trim().replace(/<\?xml[\s\S]*?\?>/gi, "");
              svg = svg.replace(/\s*xmlns:svg=["'][^"']*["']/gi, "");
              svg = svg.replace(/<(\/?)svg:([a-zA-Z0-9_-]+)/g, "<$1$2");
              svg = svg.replace(/url\(#svg:([^)]+)\)/g, "url(#$1)");

              const prefix = `layer_${idx}_`;
              svg = svg.replace(/\bid\s*=\s*['"]([^'"]+)['"]/gi, `id="${prefix}$1"`);
              svg = svg.replace(/url\(\s*['"]?#([^'")]+)['"]?\s*\)/gi, `url(#${prefix}$1)`);
              svg = svg.replace(/href\s*=\s*['"]#([^'"]+)['"]/gi, `href="#${prefix}$1"`);
              svg = svg.replace(/xlink:href\s*=\s*['"]#([^'"]+)['"]/gi, `xlink:href="#${prefix}$1"`);
              svg = svg.replace(/clip-path\s*=\s*['"]url\(#([^)]+)\)['"]/gi, `clip-path="url(#${prefix}$1)"`);

              let layerVb = "";
              let layerW = 0;
              let layerH = 0;

              const vbMatch = svg.match(/viewBox=["']([^"']+)["']/i);
              if (vbMatch) {
                layerVb = vbMatch[1];
                if (!masterViewBox) masterViewBox = layerVb;
              }
              const wMatch = svg.match(/\bwidth=["']([^"']+)["']/i);
              if (wMatch) {
                layerW = parseFloat(wMatch[1]);
                if (!masterWidth) masterWidth = wMatch[1];
              }
              const hMatch = svg.match(/\bheight=["']([^"']+)["']/i);
              if (hMatch) {
                layerH = parseFloat(hMatch[1]);
                if (!masterHeight) masterHeight = hMatch[1];
              }

              if (!layerVb && layerW > 0 && layerH > 0) {
                layerVb = `0 0 ${layerW} ${layerH}`;
              }

              const bodyMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
              if (bodyMatch && bodyMatch[1] && bodyMatch[1].trim()) {
                let layerBody = bodyMatch[1];
                if (idx > 0) {
                  layerBody = stripFullCanvasWhiteBackground(layerBody, layerW, layerH);
                }
                const effectiveVb = layerVb || masterViewBox || "0 0 1000 600";
                combinedSvgLayers.push(`<svg x="0" y="0" width="100%" height="100%" viewBox="${effectiveVb}" preserveAspectRatio="none" overflow="visible">${layerBody}</svg>`);
                convertedLayerCount++;
              } else {
                failedLayerIndexes.push(idx);
              }
            } catch (layerErr) {
              failedLayerIndexes.push(idx);
              console.warn(`Layer ${idx} conversion warning:`, layerErr);
            }
          }

          if (!isCompleteVectorComposite(entries.length, convertedLayerCount)) {
            console.warn(
              `[Radimation] Refusing incomplete vector composite: ${convertedLayerCount}/${entries.length} layers converted; failed indexes: ${failedLayerIndexes.join(",") || "unknown"}`
            );
            return null;
          }

          let viewBoxAttr = masterViewBox ? `viewBox="${masterViewBox}"` : "";
          if (!viewBoxAttr && masterWidth && masterHeight) {
            viewBoxAttr = `viewBox="0 0 ${parseFloat(masterWidth)} ${parseFloat(masterHeight)}"`;
          }
          if (!viewBoxAttr) {
            viewBoxAttr = `viewBox="0 0 1000 600"`;
          }
          let widthAttr = masterWidth ? `width="${masterWidth}"` : `width="1800"`;
          let heightAttr = masterHeight ? `height="${masterHeight}"` : `height="1080"`;

          const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${widthAttr} ${heightAttr} ${viewBoxAttr}>
            <rect width="100%" height="100%" fill="#ffffff"/>
            ${combinedSvgLayers.join("\n")}
          </svg>`;

          const resvg = new Resvg(masterSvg, {
            fitTo: { mode: "width", value: 2000 },
            background: "#ffffff",
            font: {
              loadSystemFonts: true,
              defaultFontFamily: "Liberation Sans",
              sansSerifFamily: "Liberation Sans",
              serifFamily: "Liberation Serif",
              monospaceFamily: "Liberation Mono"
            }
          } as any);

          const pngBuf = resvg.render().asPng();
          if (pngBuf && pngBuf.length > 100) {
            return `data:image/png;base64,${Buffer.from(pngBuf).toString("base64")}`;
          }
          return null;
        } catch (compErr) {
          console.error("Composite vector rendering error:", compErr);
          return null;
        }
      }

      async function getTableImage($: any, relsXml: string, zipInstance: AdmZip, tblEl: any, prevTblEl: any, allVectorEntries: any[]): Promise<string | null> {
        const $rels = cheerio.load(relsXml, { xmlMode: true });
        const candidateEntries: any[] = [];
        const seenPaths = new Set<string>();

        const nodesToSearch: any[] = [];
        if (prevTblEl) {
          let curr = $(prevTblEl).next();
          while (curr.length > 0 && curr[0] !== tblEl) {
            nodesToSearch.push(curr);
            curr = curr.next();
          }
        } else {
          let prev = $(tblEl).prev();
          const prevList: any[] = [];
          for (let i = 0; i < 50 && prev.length > 0; i++) {
            prevList.push(prev);
            prev = prev.prev();
          }
          for (let i = prevList.length - 1; i >= 0; i--) {
            nodesToSearch.push(prevList[i]);
          }
        }

        nodesToSearch.push($(tblEl));

        for (const node of nodesToSearch) {
          $(node).find("*").addBack().each((_: any, el: any) => {
            if (el.attribs) {
              Object.values(el.attribs).forEach((val: any) => {
                if (typeof val === "string") {
                  const matches = val.match(/rId\d+/g);
                  if (matches) {
                    matches.forEach((embedId: string) => {
                      const target = $rels(`Relationship[Id="${embedId}"]`).attr("Target");
                      if (target) {
                        const imagePath = target.startsWith("word/") ? target : `word/${target}`;
                        if (!seenPaths.has(imagePath)) {
                          seenPaths.add(imagePath);
                          const entry = zipInstance.getEntry(imagePath);
                          if (entry) {
                            candidateEntries.push(entry);
                          }
                        }
                      }
                    });
                  }
                }
              });
            }
          });
        }

        const vectorCandidates = candidateEntries.filter(e => {
          const t = detectMediaType(e.getData(), e.entryName);
          return t === "emf" || t === "wmf";
        });
        const webCandidates = candidateEntries.filter(e => {
          const t = detectMediaType(e.getData(), e.entryName);
          return t === "png" || t === "jpeg" || t === "gif" || t === "bmp";
        });

        const imageSource = chooseRadimationImageSource(webCandidates.length, vectorCandidates.length);

        if (imageSource === "raster") {
          const imgEntry = webCandidates.reduce((best, candidate) => {
            if (!best) return candidate;
            try {
              const bestSize = sizeOf(best.getData());
              const candidateSize = sizeOf(candidate.getData());
              return (candidateSize.width * candidateSize.height) > (bestSize.width * bestSize.height) ? candidate : best;
            } catch {
              return candidate.getData().length > best.getData().length ? candidate : best;
            }
          }, null as any);
          const raw = imgEntry.getData();
          const t = detectMediaType(raw, imgEntry.entryName);
          const mime = t === "jpeg" ? "image/jpeg" : `image/${t}`;
          return `data:${mime};base64,${raw.toString("base64")}`;
        }

        if (imageSource === "vector") {
          const composite = await renderCompositeVectorLayers(vectorCandidates);
          if (composite) return composite;
        }

        if (allVectorEntries && allVectorEntries.length > 0) {
          const composite = await renderCompositeVectorLayers(allVectorEntries);
          if (composite) return composite;
        }

        return null;
      }

      const mediaEntries = zip.getEntries().filter((e) => e.entryName.startsWith("word/media/"));
      mediaEntries.sort((a, b) => {
        const numA = parseInt(a.entryName.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.entryName.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });

      const vectorEntries = mediaEntries.filter(e => {
        const t = detectMediaType(e.getData(), e.entryName);
        return t === "emf" || t === "wmf";
      });

      if (docXmlEntry) {
        const docXml = docXmlEntry.getData().toString("utf8");
        const relsXml = relsXmlEntry ? relsXmlEntry.getData().toString("utf8") : "";
        const $ = cheerio.load(docXml, { xmlMode: true });
        
        let allTables: any[] = [];
        const tblElements = $("w\\:tbl").toArray();
        let prevTblEl: any = null;

        for (let tblIndex = 0; tblIndex < tblElements.length; tblIndex++) {
          const tblEl = tblElements[tblIndex];

          let headingText = "";
          let prev = $(tblEl).prev();
          for (let i = 0; i < 15 && prev.length > 0; i++) {
            const text = prev.text().trim();
            if (text) headingText = text + " " + headingText;
            prev = prev.prev();
          }

          let rows: string[][] = [];
          $(tblEl).find("w\\:tr").each((_, tr) => {
            let cells: string[] = [];
            $(tr).find("w\\:tc").each((_, tc) => {
              let text = $(tc).find("w\\:t").map((_, t) => $(t).text()).get().join("").trim();
              cells.push(text);
            });
            if (cells.length > 0) rows.push(cells);
          });

          if (rows.length === 0) {
            prevTblEl = tblEl;
            continue;
          }
          allTables.push(rows);

          const fullText = rows.map(r => r.join(" ")).join(" ").toLowerCase();

          // 1. EUT Info table check
          if (fullText.includes("nhãn hiệu") || fullText.includes("brand name") || fullText.includes("kiểu loại") || fullText.includes("model")) {
            rows.forEach(r => {
              const label = (r[0] || "").toLowerCase();
              const val = r[1] || "";
              if (label.includes("nhãn hiệu") || label.includes("brand")) info.brand = val;
              else if (label.includes("kiểu loại") || label.includes("model")) info.model = val;
              else if (label.includes("công suất") || label.includes("rated power")) info.power = val;
              else if (label.includes("điện áp") || label.includes("rated voltage")) info.voltage = val;
              else if (label.includes("dòng điện") || label.includes("rated current")) info.current = val;
              else if (label.includes("tần số danh nghĩa") || label.includes("rated frequency")) info.frequency = val;
              else if (label.includes("tần số xung nhịp") || label.includes("clock frequency")) info.clockFreq = val;
            });
          }

          // 2. Identify header row (check row 0, 1, 2)
          let headerRowIdx = 0;
          for (let i = 0; i < Math.min(3, rows.length); i++) {
            const rText = rows[i].join(" ").toLowerCase();
            if (rText.includes("freq") || rText.includes("tần số") || rText.includes("mhz") || rText.includes("peak") || rText.includes("average") || rText.includes("quasi") || rText.includes("qp") || rText.includes("pk") || rText.includes("dbµv") || rText.includes("dbpw") || rText.includes("nr") || rText.includes("stt") || rText.includes("point")) {
              headerRowIdx = i;
              break;
            }
          }

          const headerCells = rows[headerRowIdx].map(c => c.toLowerCase().trim());
          const headerCombined = headerCells.join(" ");

          let colPeakNum = -1, colFreq = -1, colPeak = -1, colAvg = -1, colAvgLimit = -1;
          let colQp = -1, colQpLimit = -1, colQpDiff = -1, colAvgDiff = -1, colStatus = -1;
          let colDistance = -1;

          headerCells.forEach((c, idx) => {
            const norm = c.toLowerCase().replace(/[\s\-_()\[\]]/g, "");
            if (norm.includes("peaknumber") || norm === "nr" || norm === "nr." || norm === "no" || norm === "no." || norm === "stt" || norm === "tt" || norm === "point") {
              colPeakNum = idx;
            } else if (norm.includes("frequency") || norm.includes("tầnsố") || norm.includes("tanso") || norm.includes("freq")) {
              colFreq = idx;
            } else if (norm.includes("distance") || norm.includes("khoảngcách") || norm.includes("khoangcach") || norm.includes("vịtrí") || norm.includes("vitri")) {
              colDistance = idx;
            } else if (norm.includes("averagelimit") || norm.includes("limitav") || norm.includes("gioihanav") || (norm.includes("limit") && norm.includes("av")) || (norm.includes("giớihạn") && norm.includes("tb")) || norm.includes("avglimit")) {
              colAvgLimit = idx;
            } else if (norm.includes("quasipeaklimit") || norm.includes("limitqp") || norm.includes("gioihanqp") || (norm.includes("limit") && norm.includes("qp")) || (norm.includes("giớihạn") && norm.includes("qp")) || norm.includes("qplimit")) {
              colQpLimit = idx;
            } else if (norm.includes("quasipeakdiff") || norm.includes("qpdiff") || norm.includes("qpmargin") || (norm.includes("diff") && norm.includes("qp")) || (norm.includes("độlệch") && norm.includes("qp")) || (norm.includes("dolech") && norm.includes("qp"))) {
              colQpDiff = idx;
            } else if (norm.includes("averagediff") || norm.includes("avgdiff") || norm.includes("avmargin") || (norm.includes("diff") && norm.includes("av")) || (norm.includes("độlệch") && norm.includes("av")) || (norm.includes("độlệch") && norm.includes("tb")) || (norm.includes("dolech") && norm.includes("av"))) {
              colAvgDiff = idx;
            } else if (norm.includes("quasipeak") || norm.includes("quasi") || norm.includes("qp") || norm.includes("giatriqp") || norm.includes("giátrịqp")) {
              colQp = idx;
            } else if (norm.includes("average") || norm.includes("avg") || norm.includes("trungbình") || norm.includes("trungbinh") || norm.includes("giatritb") || norm.includes("giátrịtb") || norm.includes("av(") || norm === "av") {
              colAvg = idx;
            } else if (norm.includes("peak") || norm.includes("pk") || norm.includes("đỉnh") || norm.includes("dinh")) {
              colPeak = idx;
            } else if (norm.includes("status") || norm.includes("result") || norm.includes("kếtquả") || norm.includes("ketqua") || norm.includes("đánhgiá") || norm.includes("danhgia") || norm.includes("kếtluận") || norm.includes("ketluan")) {
              colStatus = idx;
            }
          });

          const headingLower = headingText.toLowerCase();

          // 3. Power Disturbance Detection (6.3.1 / Kẹp hấp thụ / Công suất nhiễu / Disturbance Power)
          const isPower = headingLower.includes("công suất") || headingLower.includes("power") || headingLower.includes("clamp") || headingLower.includes("6.3") || headerCombined.includes("dbpw") || headerCombined.includes("distance") || headerCombined.includes("khoảng cách") || (colDistance >= 0);

          // 4. Voltage Disturbance Detection (5.3.1 / Điện áp nhiễu / Conducted Emission)
          const isVoltage = headingLower.includes("điện áp") || headingLower.includes("conducted") || headingLower.includes("5.3") || headerCombined.includes("dbµv") || headerCombined.includes("average") || headerCombined.includes("quasi-peak") || (colQp >= 0 && colAvg >= 0);

          const isPhaseN = headingLower.includes("pha n") || headingLower.includes("phase n") || headingLower.includes("5.3.1.2") || headingLower.includes("5.3.2") || headingLower.includes("dây trung tính") || headingLower.includes("neutral");
          const isPhaseL = headingLower.includes("pha l") || headingLower.includes("phase l") || headingLower.includes("5.3.1.1") || headingLower.includes("dây pha") || headingLower.includes("line");

          if (isPower && (rows.length > headerRowIdx + 1)) {
            const dataRows: any[] = [];
            for (let rIdx = headerRowIdx + 1; rIdx < rows.length; rIdx++) {
              const r = rows[rIdx];
              if (!r || r.length === 0 || r.join("").includes("{#") || r.join("").includes("{/")) continue;
              dataRows.push({
                nr: colPeakNum >= 0 ? (r[colPeakNum] || "") : (r[0] || ""),
                frequency: colFreq >= 0 ? (r[colFreq] || "") : (r[1] || ""),
                pkValue: colPeak >= 0 ? (r[colPeak] || "") : (r[2] || ""),
                avgValue: colAvg >= 0 ? (r[colAvg] || "") : (r[3] || ""),
                qpValue: colQp >= 0 ? (r[colQp] || "") : (r[4] || ""),
                avgLimit: colAvgLimit >= 0 ? (r[colAvgLimit] || "") : (r[5] || ""),
                qpLimit: colQpLimit >= 0 ? (r[colQpLimit] || "") : (r[6] || ""),
                result: colStatus >= 0 ? (r[colStatus] || "Pass") : (r[7] || "Pass"),
                status: colStatus >= 0 ? (r[colStatus] || "Pass") : (r[7] || "Pass"),
                distance: colDistance >= 0 ? (r[colDistance] || "") : (r[8] || "")
              });
            }
            if (dataRows.length > 0) {
              tablePower = dataRows;
              if (relsXml) {
                const img = await getTableImage($, relsXml, zip, tblEl, prevTblEl, vectorEntries);
                if (img) images.powerDisturbance = img;
              }
            }
          } else if ((isVoltage || colFreq >= 0) && (rows.length > headerRowIdx + 1)) {
            const dataRows: any[] = [];
            for (let rIdx = headerRowIdx + 1; rIdx < rows.length; rIdx++) {
              const r = rows[rIdx];
              if (!r || r.length === 0 || r.join("").includes("{#") || r.join("").includes("{/")) continue;
              dataRows.push({
                peakNumber: colPeakNum >= 0 ? (r[colPeakNum] || "") : (r[0] || ""),
                frequency: colFreq >= 0 ? (r[colFreq] || "") : (r[1] || ""),
                peak: colPeak >= 0 ? (r[colPeak] || "") : "",
                average: colAvg >= 0 ? (r[colAvg] || "") : (r[2] || ""),
                averageLimit: colAvgLimit >= 0 ? (r[colAvgLimit] || "") : (r[3] || ""),
                quasiPeak: colQp >= 0 ? (r[colQp] || "") : (r[4] || ""),
                quasiPeakLimit: colQpLimit >= 0 ? (r[colQpLimit] || "") : (r[5] || ""),
                quasiPeakDiff: colQpDiff >= 0 ? (r[colQpDiff] || "") : (r[6] || ""),
                averageDiff: colAvgDiff >= 0 ? (r[colAvgDiff] || "") : (r[7] || ""),
                status: colStatus >= 0 ? (r[colStatus] || "Pass") : (r[8] || "Pass")
              });
            }

            if (dataRows.length > 0) {
              let img: string | null = null;
              if (relsXml) {
                img = await getTableImage($, relsXml, zip, tblEl, prevTblEl, vectorEntries);
              }

              if (isPhaseN) {
                tablePhaseN = dataRows;
                if (img) images.phaseN = img;
                phaseNFound = true;
              } else if (isPhaseL) {
                tablePhaseL = dataRows;
                if (img) images.phaseL = img;
                phaseLFound = true;
              } else if (isPower) {
                tablePower = dataRows;
                if (img && !images.powerDisturbance) images.powerDisturbance = img;
              } else if (!phaseLFound) {
                tablePhaseL = dataRows;
                if (img) images.phaseL = img;
                phaseLFound = true;
              } else if (!phaseNFound) {
                tablePhaseN = dataRows;
                if (img) images.phaseN = img;
                phaseNFound = true;
              }
            }
          }

          prevTblEl = tblEl;
        }
        
        if (allTables.length > 0) {
          const lastTable = allTables[allTables.length - 1];
          tableData = lastTable;
        }
      }

      let vectorBase64 = "";
      let vectorType = "";
      let allVectors: string[] = [];
      let imageBase64 = "";
      let allWebImages: string[] = [];
      let vectorCompositeComplete = vectorEntries.length === 0;

      for (const entry of mediaEntries) {
        try {
          const rawBuf = entry.getData();
          if (!rawBuf || rawBuf.length === 0) continue;
          
          const mediaType = detectMediaType(rawBuf, entry.entryName);
          if (mediaType === "png" || mediaType === "jpeg" || mediaType === "gif" || mediaType === "bmp") {
            const mime = mediaType === "jpeg" ? "image/jpeg" : `image/${mediaType}`;
            allWebImages.push(`data:${mime};base64,${rawBuf.toString("base64")}`);
          } else if (mediaType === "emf" || mediaType === "wmf") {
            allVectors.push(`data:image/x-${mediaType};base64,${rawBuf.toString("base64")}`);
          }
        } catch (err) {
          console.error(`Error processing media entry ${entry.entryName}:`, err);
        }
      }

      if (vectorEntries.length > 0) {
        const compositePng = await renderCompositeVectorLayers(vectorEntries);
        vectorCompositeComplete = Boolean(compositePng);
        if (compositePng) {
          imageBase64 = compositePng;
          allWebImages.unshift(compositePng);

          if (tablePhaseL.length > 0 && tablePhaseN.length === 0 && tablePower.length === 0) {
            images.phaseL = compositePng;
          } else if (tablePhaseN.length > 0 && tablePhaseL.length === 0 && tablePower.length === 0) {
            images.phaseN = compositePng;
          } else if (tablePower.length > 0 && tablePhaseL.length === 0 && tablePhaseN.length === 0) {
            images.powerDisturbance = compositePng;
          }
        }
      }

      if (!imageBase64 && allWebImages.length > 0) {
        imageBase64 = allWebImages[0];
      }

      if (imageBase64) {
        if (tablePhaseL.length > 0 && !images.phaseL) {
          images.phaseL = imageBase64;
        } else if (tablePhaseN.length > 0 && !images.phaseN) {
          images.phaseN = imageBase64;
        } else if (tablePower.length > 0 && !images.powerDisturbance) {
          images.powerDisturbance = imageBase64;
        } else if (!images.phaseL) {
          images.phaseL = imageBase64;
        }
      }

      if (allVectors.length > 0) {
        vectorBase64 = allVectors[0];
        vectorType = vectorBase64.includes("x-wmf") ? "wmf" : "emf";
      }

      res.json({
        success: true,
        imageBase64,
        vectorBase64,
        vectorType,
        allVectors,
        vectorCompositeComplete,
        allWebImages,
        images,
        tableData,
        tablePhaseL,
        tablePhaseN,
        tablePower,
        info
      });
    } catch (error: any) {
      console.error("Error extracting radimation:", error);
      res.status(500).json({ error: error.message });
    }
  });

  async function ensurePngBuffer(rawBuf: Buffer): Promise<Buffer> {
    if (!rawBuf || rawBuf.length < 4) return rawBuf;
    const isEmf = rawBuf.length > 44 && rawBuf[0] === 1 && rawBuf[1] === 0 && rawBuf[2] === 0 && rawBuf[3] === 0 &&
                  rawBuf[40] === 0x20 && rawBuf[41] === 0x45 && rawBuf[42] === 0x4D && rawBuf[43] === 0x46;
    const isWmf = (rawBuf.length > 4 && rawBuf[0] === 0xD7 && rawBuf[1] === 0xCD && rawBuf[2] === 0xC6 && rawBuf[3] === 0x9A) ||
                  (rawBuf.length > 4 && (rawBuf[0] === 0x01 || rawBuf[0] === 0x02) && rawBuf[1] === 0x00 && rawBuf[2] === 0x09 && rawBuf[3] === 0x00);
    
    if (isEmf || isWmf) {
      try {
        const kind = isWmf ? "wmf" : "emf";
        const convertToSvg = await getEmfOrWmfToSvg();
        const svg = await convertToSvg(kind as any, new Uint8Array(rawBuf), 96);
        if (svg && typeof svg === "string" && svg.includes("<svg")) {
          const resvg = new Resvg(svg, {
            fitTo: { mode: "width", value: 2000 },
            background: "#ffffff",
            font: {
              loadSystemFonts: true,
              defaultFontFamily: "Liberation Sans",
              sansSerifFamily: "Liberation Sans",
              serifFamily: "Liberation Serif",
              monospaceFamily: "Liberation Mono"
            }
          } as any);
          const pngBuf = resvg.render().asPng();
          if (pngBuf && pngBuf.length > 100) {
            return Buffer.from(pngBuf);
          }
        }
      } catch (err) {
        console.warn("Vector to PNG conversion in docx error:", err);
      }
    }
    return rawBuf;
  }

  async function preprocessImages(obj: Record<string, any>) {
    if (!obj || typeof obj !== "object") return;
    const keys = Object.keys(obj);
    for (const k of keys) {
      const val = obj[k];
      if (typeof val === "string" && (val.startsWith("data:") || val.length > 150)) {
        let base64 = val;
        if (base64.includes(",")) {
          base64 = base64.split(",")[1];
        }
        try {
          const rawBuf = Buffer.from(base64, "base64");
          const pngBuf = await ensurePngBuffer(rawBuf);
          if (pngBuf !== rawBuf) {
            obj[k] = `data:image/png;base64,${pngBuf.toString("base64")}`;
          }
        } catch (e) {
        }
      } else if (val && typeof val === "object" && !Array.isArray(val)) {
        await preprocessImages(val);
      }
    }
  }

  app.post("/api/generate-docx", async (req, res) => {
    try {
      const body = req.body;
      const { ocrData, testResults, standard, criteriaType, productPhoto1, productPhoto2, nameplatePhoto1, nameplatePhoto2, nameplatePhotos, reportMeta, emcData, dayCapDienData, subOptionTitle } = body;
      const docxMetadata = buildReportDocxMetadata({ reportMeta, ocrData, emcData });

      if (emcData) {
        Object.keys(emcData).forEach((key) => {
          if (key.startsWith("table") && Array.isArray(emcData[key])) {
            emcData[key] = emcData[key].map((row: any) => ({
              ...row,
              Peak: row.peak || row.Peak || "",
            }));
          }
        });
      }

      let formattedTestDate = reportMeta?.testDate || "";
      if (formattedTestDate) {
        formattedTestDate = formattedTestDate
          .split(" – ")
          .map((d: string) => {
            if (!d) return "";
            const parts = d.split("-");
            if (parts.length === 3) {
              return `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            return d;
          })
          .join(" – ");
      }

      let formattedSampleReceiptDate = reportMeta?.sampleReceiptDate || "";
      if (formattedSampleReceiptDate) {
        const parts = formattedSampleReceiptDate.split("-");
        if (parts.length === 3) {
          formattedSampleReceiptDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      const data: any = {
        reportNo: reportMeta?.reportNo || "",
        sampleName: reportMeta?.sampleName || "",
        deviceName: reportMeta?.deviceNameVi || standard?.name || "",
        deviceNameEn: reportMeta?.deviceNameEn || "",
        model: reportMeta?.model || "",
        codingNumber: docxMetadata.codingNumber,
        sealStamp: docxMetadata.sealStamp,
        brand: reportMeta?.brand || "",
        manufacturer: docxMetadata.manufacturer,
        countryOfOrigin: docxMetadata.countryOfOrigin,
        testerName: reportMeta?.testerName || "",
        managerName: reportMeta?.managerName || "",
        managerNam: reportMeta?.managerName || "",
        reportDate: docxMetadata.reportDate,
        sampleReceiptDate: formattedSampleReceiptDate,
        testDate: formattedTestDate,
        senderUnit: reportMeta?.senderUnit || "",
        senderAddress: reportMeta?.senderAddress || "",
        method: reportMeta?.testMethod ? (Array.isArray(reportMeta.testMethod) ? reportMeta.testMethod.join(", ") : reportMeta.testMethod) : "",
        standard: reportMeta?.evaluationStandard && reportMeta.evaluationStandard.length > 0 ? (Array.isArray(reportMeta.evaluationStandard) ? reportMeta.evaluationStandard.join(", ") : reportMeta.evaluationStandard) : standard?.standard || "",
        ...(emcData?.images || {}),
        nameplateImage: "",
        nameplateImage2: "",
        emcPower: docxMetadata.emcPower,
        emcVoltage: docxMetadata.emcVoltage,
        emcCurrent: docxMetadata.emcCurrent,
        emcFrequency: docxMetadata.emcFrequency,
        emcClockFreq: docxMetadata.emcClockFreq,
        emcAmbientTemp: emcData?.ambientTemp || "",
        emcAmbientHumidity: emcData?.ambientHumidity || "",
        emcImageLabel: emcData?.images?.label || "",
        emcImagePhaseL: emcData?.images?.phaseL || "",
        image_5_3_1: emcData?.images?.phaseL || "",
        emcImagePhaseN: emcData?.images?.phaseN || "",
        image_5_3_2: emcData?.images?.phaseN || "",
        emcImagePowerDist: emcData?.images?.powerDisturbance || "",
        image_6_3_1: emcData?.images?.powerDisturbance || "",

        emcImageDiscont: emcData?.images?.discontinuousPhaseN || "",
        image_7_3_1: emcData?.images?.discontinuousPhaseN || "",
        emcImageSample: emcData?.images?.sample || "",
        emcImageSetupVoltage: emcData?.images?.setupVoltage || "",
        emcImageSetupPower: emcData?.images?.setupPower || "",
        tablePhaseL: emcData?.tablePhaseL || [],

        isAirConNoLoad: subOptionTitle?.toLowerCase().includes("không có đầu nối tải") || false,

        table_6_3_1_1: subOptionTitle === "Bếp từ 4 vùng nấu" || subOptionTitle === "Bếp từ 3 vùng nấu" || subOptionTitle === "Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại" || subOptionTitle === "Bếp từ + hồng ngoại" || subOptionTitle === "Bếp từ 2 vùng nấu" ? emcData.tableMag1_A || [] : (emcData?.tablePower || []).slice(0, 1),
        table_6_3_1_2: subOptionTitle === "loại hai chiều" || standard?.id === "emc_dieu_hoa" ? (emcData?.tablePowerDisturbance_indoor || []).slice(0, 1) : emcData.tableMag1_B || [],
        table_6_3_1_3: subOptionTitle === "loại hai chiều" || standard?.id === "emc_dieu_hoa" ? (emcData?.tablePowerDisturbance_outdoor || []).slice(0, 1) : emcData.tableMag1_C || [],
        table_6_3_2_1: subOptionTitle === "Bếp từ 4 vùng nấu" || subOptionTitle === "Bếp từ 3 vùng nấu" || subOptionTitle === "Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại" || subOptionTitle === "Bếp từ + hồng ngoại" || subOptionTitle === "Bếp từ 2 vùng nấu" ? emcData.tableMag2_A || [] : (emcData?.tablePower_2 || []).slice(0, 1),
        table_6_3_2_2: subOptionTitle === "loại hai chiều" || standard?.id === "emc_dieu_hoa" ? (emcData?.tablePowerDisturbance_indoor_2 || []).slice(0, 1) : emcData.tableMag2_B || [],
        table_6_3_2_3: subOptionTitle === "loại hai chiều" || standard?.id === "emc_dieu_hoa" ? (emcData?.tablePowerDisturbance_outdoor_2 || []).slice(0, 1) : emcData.tableMag2_C || [],
        table_7_3_1_1: (emcData.tablePower || []).slice(0, 1),
        table_7_3_2_1: (emcData.tablePower_2 || []).slice(0, 1),
        table_5_3_1: emcData?.tablePhaseL || [],
        tablePhaseN: emcData?.tablePhaseN || [],
        table_5_3_2: emcData?.tablePhaseN || [],
        tablePower: (emcData?.tablePower || []).slice(0, 1),
        table_6_3_1: (emcData?.tablePower || []).slice(0, 1),
        image_5_3_1_1: emcData?.images?.phaseL || "",
        image_5_3_1_1_1: emcData?.images?.phaseL || "",
        table_5_3_1_1: emcData?.tablePhaseL || [],
        table_5_3_1_1_1: emcData?.tablePhaseL || [],
        image_5_3_1_2: emcData?.images?.phaseN || "",
        image_5_3_1_1_2: emcData?.images?.phaseN || "",
        table_5_3_1_2: emcData?.tablePhaseN || [],
        table_5_3_1_1_2: emcData?.tablePhaseN || [],
        image_5_3_1_2_1: emcData?.images?.phaseL_outdoor || "",
        table_5_3_1_2_1: emcData?.tablePhaseL_outdoor || [],
        image_5_3_1_2_2: emcData?.images?.phaseN_outdoor || "",
        table_5_3_1_2_2: emcData?.tablePhaseN_outdoor || [],
        image_5_3_1_2_3: emcData?.images?.phaseL_indoor || "",
        table_5_3_1_2_3: emcData?.tablePhaseL_indoor || [],
        image_5_3_1_2_4: emcData?.images?.phaseN_indoor || "",
        table_5_3_1_2_4: emcData?.tablePhaseN_indoor || [],
        image_5_3_1_2_5: (subOptionTitle?.toLowerCase().includes("không có đầu nối tải") ? emcData?.images?.PE_outdoor : emcData?.images?.S1_outdoor) || "",
        table_5_3_1_2_5: (subOptionTitle?.toLowerCase().includes("không có đầu nối tải") ? emcData?.tablePE_outdoor : emcData?.tableS1_outdoor) || [],
        image_5_3_1_2_6: (subOptionTitle?.toLowerCase().includes("không có đầu nối tải") ? emcData?.images?.PE_indoor : emcData?.images?.S1_indoor) || "",
        table_5_3_1_2_6: (subOptionTitle?.toLowerCase().includes("không có đầu nối tải") ? emcData?.tablePE_indoor : emcData?.tableS1_indoor) || [],
        image_5_3_1_2_7: emcData?.images?.PE_outdoor || "",
        table_5_3_1_2_7: emcData?.tablePE_outdoor || [],
        image_5_3_1_2_8: emcData?.images?.PE_indoor || "",
        table_5_3_1_2_8: emcData?.tablePE_indoor || [],
        image_6_3_1_1: subOptionTitle === "Bếp từ 4 vùng nấu" || subOptionTitle === "Bếp từ 3 vùng nấu" || subOptionTitle === "Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại" || subOptionTitle === "Bếp từ + hồng ngoại" || subOptionTitle === "Bếp từ 2 vùng nấu" ? emcData?.images?.mag1_A || "" : emcData?.images?.powerDisturbance || "",
        image_6_3_1_2: subOptionTitle === "loại hai chiều" || standard?.id === "emc_dieu_hoa" ? emcData?.images?.powerDisturbance_indoor || "" : emcData?.images?.mag1_B || "",
        image_6_3_1_3: subOptionTitle === "loại hai chiều" || standard?.id === "emc_dieu_hoa" ? emcData?.images?.powerDisturbance_outdoor || "" : emcData?.images?.mag1_C || "",
        image_7_3_1_1: subOptionTitle === "Bếp từ 4 vùng nấu" || subOptionTitle === "Bếp từ 3 vùng nấu" || subOptionTitle === "Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại" || subOptionTitle === "Bếp từ + hồng ngoại" || subOptionTitle === "Bếp từ 2 vùng nấu" ? emcData?.images?.powerDisturbance || "" : emcData?.images?.discontinuousPhaseN || "",
        image_8_3_1_1: emcData?.images?.discontinuousPhaseN || "",

        image_5_3_2_1: emcData?.images?.phaseL_2 || "",
        table_5_3_2_1: emcData?.tablePhaseL_2 || [],
        image_5_3_2_2: emcData?.images?.phaseN_2 || "",
        table_5_3_2_2: emcData?.tablePhaseN_2 || [],
        image_5_3_2_1_1: emcData?.images?.phaseL_2 || "",
        table_5_3_2_1_1: emcData?.tablePhaseL_2 || [],
        image_5_3_2_1_2: emcData?.images?.phaseN_2 || "",
        table_5_3_2_1_2: emcData?.tablePhaseN_2 || [],
        image_5_3_2_2_1: emcData?.images?.phaseL_outdoor_2 || "",
        table_5_3_2_2_1: emcData?.tablePhaseL_outdoor_2 || [],
        image_5_3_2_2_2: emcData?.images?.phaseN_outdoor_2 || "",
        table_5_3_2_2_2: emcData?.tablePhaseN_outdoor_2 || [],
        image_5_3_2_2_3: emcData?.images?.phaseL_indoor_2 || "",
        table_5_3_2_2_3: emcData?.tablePhaseL_indoor_2 || [],
        image_5_3_2_2_4: emcData?.images?.phaseN_indoor_2 || "",
        table_5_3_2_2_4: emcData?.tablePhaseN_indoor_2 || [],
        image_5_3_2_2_5: emcData?.images?.S1_outdoor_2 || "",
        table_5_3_2_2_5: emcData?.tableS1_outdoor_2 || [],
        image_5_3_2_2_6: emcData?.images?.S1_indoor_2 || "",
        table_5_3_2_2_6: emcData?.tableS1_indoor_2 || [],
        image_5_3_2_2_7: emcData?.images?.PE_outdoor_2 || "",
        table_5_3_2_2_7: emcData?.tablePE_outdoor_2 || [],
        image_5_3_2_2_8: emcData?.images?.PE_indoor_2 || "",
        table_5_3_2_2_8: emcData?.tablePE_indoor_2 || [],
        image_6_3_2_1: subOptionTitle === "Bếp từ 4 vùng nấu" || subOptionTitle === "Bếp từ 3 vùng nấu" || subOptionTitle === "Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại" || subOptionTitle === "Bếp từ + hồng ngoại" || subOptionTitle === "Bếp từ 2 vùng nấu" ? emcData?.images?.mag2_A || "" : emcData?.images?.powerDisturbance_2 || "",
        image_6_3_2_2: subOptionTitle === "loại hai chiều" || standard?.id === "emc_dieu_hoa" ? emcData?.images?.powerDisturbance_indoor_2 || "" : emcData?.images?.mag2_B || "",
        image_6_3_2_3: subOptionTitle === "loại hai chiều" || standard?.id === "emc_dieu_hoa" ? emcData?.images?.powerDisturbance_outdoor_2 || "" : emcData?.images?.mag2_C || "",
        image_7_3_2_1: subOptionTitle === "Bếp từ 4 vùng nấu" || subOptionTitle === "Bếp từ 3 vùng nấu" || subOptionTitle === "Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại" || subOptionTitle === "Bếp từ + hồng ngoại" || subOptionTitle === "Bếp từ 2 vùng nấu" ? emcData?.images?.powerDisturbance_2 || "" : emcData?.images?.discontinuousPhaseN_2 || "",
        image_8_3_2_1: emcData?.images?.discontinuousPhaseN_2 || "",

        image_5_3_3_1: emcData?.images?.phaseL_3 || "",
        table_5_3_3_1: emcData?.tablePhaseL_3 || [],
        image_5_3_3_2: emcData?.images?.phaseN_3 || "",
        table_5_3_3_2: emcData?.tablePhaseN_3 || [],
        image_7_3_3_1: emcData?.images?.powerDisturbance_3 || "",
        table_7_3_3_1: emcData?.tablePower_3 || [],
        image_8_3_3_1: emcData?.images?.discontinuousPhaseN_3 || "",
        table_6_3_3_1: emcData?.tableMag3_A || [],
        table_6_3_3_2: emcData?.tableMag3_B || [],
        table_6_3_3_3: emcData?.tableMag3_C || [],
        image_6_3_3_1: emcData?.images?.mag3_A || "",
        image_6_3_3_2: emcData?.images?.mag3_B || "",
        image_6_3_3_3: emcData?.images?.mag3_C || "",

        image_5_3_4_1: emcData?.images?.phaseL_4 || "",
        table_5_3_4_1: emcData?.tablePhaseL_4 || [],
        image_5_3_4_2: emcData?.images?.phaseN_4 || "",
        table_5_3_4_2: emcData?.tablePhaseN_4 || [],
        image_7_3_4_1: emcData?.images?.powerDisturbance_4 || "",
        table_7_3_4_1: emcData?.tablePower_4 || [],
        image_8_3_4_1: emcData?.images?.discontinuousPhaseN_4 || "",
        table_6_3_4_1: emcData?.tableMag4_A || [],
        table_6_3_4_2: emcData?.tableMag4_B || [],
        table_6_3_4_3: emcData?.tableMag4_C || [],
        image_6_3_4_1: emcData?.images?.mag4_A || "",
        image_6_3_4_2: emcData?.images?.mag4_B || "",
        image_6_3_4_3: emcData?.images?.mag4_C || "",
      };

      const reportImageMappingInput = {
        standardId: standard?.id,
        images: emcData?.images,
        productPhoto1,
        nameplatePhoto1,
        nameplatePhoto2,
        nameplatePhotos,
      };
      const labelImages = getReportDocxLabelImages(reportImageMappingInput);
      const combinedLabelImage = await combineReportDocxLabelImages(labelImages);
      Object.assign(data, buildReportDocxImageSlots({
        ...reportImageMappingInput,
        combinedLabelImage,
      }));

      if (subOptionTitle === "Bếp từ 1 vùng nấu") {
        data.image_5_3_1 = emcData?.images?.phaseL || "";
        data.image_5_3_2 = emcData?.images?.phaseN || "";
        data.image_6_3_1 = emcData?.images?.mag1_A || "";
        data.image_6_3_1_2 = emcData?.images?.mag1_B || "";
        data.image_6_3_3 = emcData?.images?.mag1_C || "";
        data.table_6_3_1 = emcData?.tableMag1_A || [];
        data.table_6_3_2 = emcData?.tableMag1_B || [];
        data.table_6_3_3 = emcData?.tableMag1_C || [];
        data.image_7_3_1 = emcData?.images?.powerDisturbance || "";
        data.table_7_3_1 = (emcData?.tablePower || []).slice(0, 1);
        data.image_8_3_1 = emcData?.images?.discontinuousPhaseN || "";
      }

      if (standard?.id === "emc_may_giat" || standard?.id === "emc_may_hut_bui" || standard?.id === "emc_may_say_toc" || standard?.id === "emc_may_xay" || standard?.id === "emc_may_khoan") {
        data.image_6_3_1_1 = emcData?.images?.powerDisturbance || "";
        data.table_6_3_1_1 = (emcData?.tablePower || []).slice(0, 1);
        data.image_6_3_2_1 = emcData?.images?.powerDisturbance_2 || "";
        data.table_6_3_2_1 = (emcData?.tablePower_2 || []).slice(0, 1);

        if (subOptionTitle === "Có chức năng sấy") {
          data.image_6_3_3_1 = emcData?.images?.powerDisturbance_3 || "";
          data.table_6_3_3_1 = (emcData?.tablePower_3 || []).slice(0, 1);
        }
      }

      if (testResults) {
        Object.keys(testResults).forEach((clauseId) => {
          const safeId = clauseId.replace(/\./g, "_");
          const entry = testResults[clauseId];
          data[`res_${safeId}`] = entry.result || "";
          data[`eval_${safeId}`] = entry.evaluation || "";

          if (entry.subData) {
            data[`t_${safeId}`] = entry.subData;

            if (!Array.isArray(entry.subData)) {
              if (entry.subData.ambient) data[`${safeId}_ambient`] = entry.subData.ambient;
              if (entry.subData.inputTemp) {
                data[`${safeId}_inputTemp`] = entry.subData.inputTemp;
                data[`${safeId}_sec_0_tempIn`] = entry.subData.inputTemp;
              }
              if (entry.subData.condition) data[`${safeId}_condition`] = entry.subData.condition;
              if (entry.subData.workFollow && safeId !== "19") data[`${safeId}_workFollow`] = entry.subData.workFollow;

              if (entry.subData.rows && Array.isArray(entry.subData.rows)) {
                data["table_" + safeId + "_rows"] = entry.subData.rows;
                entry.subData.rows.forEach((row: any, i: number) => {
                  data[`${safeId}_row_${i}_name`] = row.name || "";
                  data[`${safeId}_row_${i}_unit`] = row.unit || "";
                  data[`${safeId}_row_${i}_res`] = row.result || "";
                  data[`${safeId}_row_${i}_lim`] = row.limit || "";
                });
              }
            } else {
              const tableArray: any[] = [];
              entry.subData.forEach((row: any, i: number) => {
                if (row.section) {
                  data[`${safeId}_sec_${i}`] = row.section;
                  if (row.tempIn) data[`${safeId}_sec_${i}_tempIn`] = row.tempIn;
                  if (row.tempOut) data[`${safeId}_sec_${i}_tempOut`] = row.tempOut;
                  if (row.rows && Array.isArray(row.rows)) {
                    row.rows.forEach((subRow: any, j: number) => {
                      data[`${safeId}_sec_${i}_row_${j}_name`] = subRow.name || "";
                      data[`${safeId}_sec_${i}_row_${j}_unit`] = subRow.unit || "";
                      data[`${safeId}_sec_${i}_row_${j}_res`] = subRow.result || "";
                      data[`${safeId}_sec_${i}_row_${j}_lim`] = subRow.limit || "";
                    });
                  }
                } else {
                  data[`${safeId}_row_${i}_cond`] = row.cond || "";
                  data[`${safeId}_row_${i}_nom`] = row.nominal || "";
                  data[`${safeId}_row_${i}_unit`] = row.unit || "";
                  data[`${safeId}_row_${i}_res`] = row.result || "";
                  data[`${safeId}_row_${i}_lim`] = row.limit || "";
                  data[`${safeId}_row_${i}_dev`] = row.dev || "";
                  data[`${safeId}_row_${i}_name`] = row.name || "";

                  tableArray.push({
                    cond: row.cond || "",
                    nom: row.nominal || "",
                    unit: row.unit || "",
                    res: row.result || "",
                    result: row.result || "",
                    lim: row.limit || "",
                    limit: row.limit || "",
                    dev: row.dev || "",
                    name: row.name || "",
                  });
                }
              });

              if (tableArray.length > 0) {
                data[`table_${safeId}`] = tableArray;
              }
            }
          }
        });
      }

      let templateFile = criteriaType === "reduced" ? "5699-2-9 placeholder 4.docx" : "5699-2-9 placeholder.docx";

      if (standard?.standard === "TCVN 5699-2-3") {
        templateFile = criteriaType === "reduced" ? "5699-2-3 placeholder 4.docx" : "5699-2-3 placeholder.docx";
      } else if (standard?.standard === "TCVN 5699-2-15") {
        templateFile = criteriaType === "reduced" ? "5699-2-15 placeholder 4.docx" : "5699-2-15 placeholder.docx";
      } else if (standard?.standard === "TCVN 5699-2-80") {
        templateFile = criteriaType === "reduced" ? "5699-2-80 placeholder 4.docx" : "5699-2-80 placeholder.docx";
      } else if (standard?.standard === "TCVN 5699-2-21") {
        templateFile = criteriaType === "reduced" ? "5699-2-21 placeholder 4.docx" : "5699-2-21 placeholder.docx";
      } else if (standard?.standard === "TCVN 5699-2-23") {
        templateFile = criteriaType === "reduced" ? "5699-2-23 placeholder 4.docx" : "5699-2-23 placeholder.docx";
      } else if (standard?.standard === "TCVN 5699-2-35") {
        templateFile = criteriaType === "reduced" ? "5699-2-35 placeholder 4.docx" : "5699-2-35 placeholder.docx";
      } else if (standard?.standard === "TCVN 5699-2-25") {
        templateFile = criteriaType === "reduced" ? "5699-2-25 placeholder 4.docx" : "5699-2-25 placeholder.docx";
      } else if (standard?.id === "emc_dung_cu_dien_dun_nuoc_nong") {
        templateFile = "DCDNNTT placeholder.docx";
      } else if (standard?.id === "emc_tu_lanh") {
        templateFile = "tulanh placeholder.docx";
      } else if (subOptionTitle === "Bếp từ 1 vùng nấu") {
        templateFile = "1T placeholder.docx";
      } else if (subOptionTitle === "Bếp điện 1 vùng nấu") {
        templateFile = "bepdien1vungnau placeholder.docx";
      } else if (subOptionTitle === "Bếp điện 2 vùng nấu") {
        templateFile = "bepdien2vungnau placeholder.docx";
      } else if (subOptionTitle === "Bếp từ 4 vùng nấu") {
        templateFile = "4T placeholder.docx";
      } else if (subOptionTitle === "Bếp từ 3 vùng nấu") {
        templateFile = "3T placeholder.docx";
      } else if (subOptionTitle === "Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại") {
        templateFile = "2T1HN placeholder.docx";
      } else if (subOptionTitle === "Bếp từ 2 vùng nấu") {
        templateFile = "2T placeholder.docx";
      } else if (subOptionTitle === "Bếp từ + hồng ngoại") {
        templateFile = "1T1HN placeholder.docx";
      } else if (subOptionTitle === "loại hai chiều") {
        templateFile = "loai2chieu placeholder.docx";
      } else if (subOptionTitle?.toLowerCase().includes("1 khối-loại hai chiều")) {
        templateFile = "1khoiloai2chieu placeholder.docx";
      } else if (subOptionTitle?.toLowerCase().includes("1 khối-loại một chiều")) {
        templateFile = "1khoiloai1chieu placeholder.docx";
      } else if (subOptionTitle?.toLowerCase().includes("một chiều-không có đầu nối tải")) {
        templateFile = "loai1chieuKCDNT placeholder.docx";
      } else if (subOptionTitle?.toLowerCase().includes("một chiều")) {
        templateFile = "loai1chieu placeholder.docx";
      } else if (standard?.id === "emc_may_giat") {
        if (subOptionTitle === "Có chức năng sấy") {
          templateFile = "MGCS placeholder.docx";
        } else if (subOptionTitle === "Không có chức năng sấy") {
          templateFile = "MGKCS placeholder.docx";
        }
      } else if (standard?.id === "emc_may_hut_bui") {
        if (subOptionTitle === "Có dùng tay giả") {
          templateFile = "MHBCTG placeholder.docx";
        } else if (subOptionTitle === "Không dùng tay giả") {
          templateFile = "MHBKTG placeholder.docx";
        }
      } else if (standard?.id === "emc_may_say_toc") {
        templateFile = "maysaytoc placeholder.docx";
      } else if (standard?.id === "emc_may_xay") {
        if (subOptionTitle === "Có dùng tay giả") {
          templateFile = "MXCTG placeholder.docx";
        } else if (subOptionTitle === "Không dùng tay giả") {
          templateFile = "MXKTG placeholder.docx";
        }
      } else if (standard?.id === "emc_may_khoan") {
        templateFile = "maykhoan placeholder.docx";
      } else if (standard?.id === "day_cap_dien") {
        if (criteriaType === "reduced") {
          templateFile = "daycapdien 4 placeholder.docx";
        } else {
          templateFile = "daycapdien placeholder.docx";
        }
      }

      let templatePath = path.join(process.cwd(), "public", templateFile);

      if (!fs.existsSync(templatePath)) {
        throw new Error(`No template file found in public directory. Looking for: ${templateFile}`);
      }

      let content = fs.readFileSync(templatePath);
      if (!content || content.length === 0) {
        throw new Error(`Template file ${templateFile} is empty.`);
      }

      let zip = new PizZip(content);

      const imageOptions = {
        centered: false,
        getImage: (tagValue: string) => {
          if (!tagValue || typeof tagValue !== "string") return null;
          let base64 = tagValue;
          if (base64.includes(",")) {
            base64 = base64.split(",")[1];
          }
          try {
            return Buffer.from(base64, "base64");
          } catch (e) {
            console.error("Image decode error:", e);
            return null;
          }
        },
        getSize: (img: Buffer, tagValue: any, tagName: string) => {
          try {
            if (!img) return [560, 315];
            let w = 560;
            let h = 315;
            try {
              const dimensions = sizeOf(img);
              if (dimensions.width && dimensions.height) {
                w = dimensions.width;
                h = dimensions.height;
              }
            } catch (err) {
            }

            const isEmcChart = Boolean(
              tagName && (
                tagName.startsWith("emcImage") ||
                tagName.startsWith("image_") ||
                tagName.startsWith("graph_") ||
                tagName.startsWith("chart_") ||
                tagName.toLowerCase().includes("emc") ||
                (emcData?.images && (tagName in emcData.images || Object.values(emcData.images).includes(tagValue)))
              )
            );

            if (isEmcChart) {
              return getDocxGraphSize(w, h);
            }

            let MAX_WIDTH = 560;
            let MAX_HEIGHT = 580;

            if (tagName === "anh_6") {
              MAX_WIDTH = 560;
              MAX_HEIGHT = 350;
            } else if (tagName && tagName.startsWith("anh_")) {
              MAX_WIDTH = 450;
              MAX_HEIGHT = 280;
            } else if (tagName && tagName.startsWith("productImage")) {
              const hasBothProduct = Boolean(body.productPhoto1 && body.productPhoto2);
              const hasAnyNameplate = Boolean(body.nameplatePhoto1 || body.nameplatePhoto2);
              MAX_WIDTH = hasBothProduct ? 270 : 560;
              MAX_HEIGHT = hasAnyNameplate ? 280 : 560;
            } else if (tagName && tagName.startsWith("nameplateImage")) {
              const hasBothNameplate = Boolean(body.nameplatePhoto1 && body.nameplatePhoto2);
              const hasAnyProduct = Boolean(body.productPhoto1 || body.productPhoto2);
              MAX_WIDTH = hasBothNameplate ? 270 : 560;
              MAX_HEIGHT = hasAnyProduct ? 280 : 560;
            }

            const ratio = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h);
            const finalW = Math.round(w * ratio);
            const finalH = Math.round(h * ratio);

            return [finalW, finalH];
          } catch (err) {
            console.error("Error getting image size:", err);
            return [560, 315];
          }
        },
      };

      const imageModule = new ImageModule(imageOptions);

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [imageModule],
        nullGetter: function () {
          return "";
        },
      });

      const allNameplates: string[] = Array.isArray(nameplatePhotos) && nameplatePhotos.length > 0
        ? nameplatePhotos.filter(Boolean)
        : [nameplatePhoto1, nameplatePhoto2].filter(Boolean);

      data.productImage1 = productPhoto1 || "";
      data.productImage = productPhoto1 || "";
      data.productImage2 = productPhoto2 || "";
      data.nameplateImage1 = allNameplates[0] || nameplatePhoto1 || "";
      data.nameplateImage = allNameplates[0] || nameplatePhoto1 || "";
      data.nameplateImage2 = allNameplates[1] || nameplatePhoto2 || "";
      data.nameplateImage3 = allNameplates[2] || "";
      data.nameplateImage4 = allNameplates[3] || "";
      data.nameplateImages = allNameplates.map((img, idx) => ({ image: img, index: idx + 1 }));

      if (dayCapDienData && dayCapDienData.items) {
        Object.keys(dayCapDienData.items).forEach((key) => {
          const flatKey = key.replace(".", "_");
          data[`muc_${flatKey}`] = dayCapDienData.items[key].limit;
          data[`kq_${flatKey}`] = dayCapDienData.items[key].result;
        });
        data.donvi_4_3 = dayCapDienData.dropdown4_3 === "Điện trở cách điện" ? "MΩ.km" : "Ω.cm";
        data.muc_4_3_label = dayCapDienData.dropdown4_3;
      }

      await preprocessImages(data);

      doc.render(data);

      const buf = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      });

      const b64 = buf.toString("base64");
      res.json({ base64: b64, filename: `Report_${reportMeta?.sampleName || "Device"}.docx` });
    } catch (error) {
      console.error("Gen DOCX Error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const activeAi = getGeminiClient(req);
      const preferredModel = req.headers["x-gemini-model"] as string | undefined;
      const { action, viName, base64, base64s } = req.body;

      if (action === "translate") {
        const response = await generateContentWithRetryAndFallback(activeAi, {
          contents: `Dịch tên thiết bị sau sang tiếng Anh: "${viName}". Chỉ trả về tên tiếng Anh.`
        }, preferredModel);
        return res.json({ text: response.text });
      }

      if (action === "ocr") {
        const imagesList: string[] = Array.isArray(base64s) && base64s.length > 0
          ? base64s
          : (base64 ? [base64] : []);

        if (imagesList.length === 0) {
          return res.status(400).json({ error: "Không có hình ảnh để thực hiện OCR" });
        }

        const promptText = `Trích xuất toàn bộ thông tin kỹ thuật từ hình ảnh tem mác/nhãn sản phẩm này của thiết bị điện.
HƯỚNG DẪN QUAN TRỌNG:
1. Nhận diện Tem Niêm Phong (sealStamp):
   - Tìm và trích xuất mã số/ký hiệu tem niêm phong có tiền tố IEMM (dạng IEMM...., IEMM/..., IEMM.xx/..., IEMM-..., IEMM xxxx) hoặc tem niêm phong mẫu, niêm chì, mã vạch tem niêm phong. Mọi mã bắt đầu bằng tiền tố IEMM dưới bất kỳ dạng nào đều là Số tem niêm phong.
   - Nếu có nhiều tem niêm phong trên các ảnh, hãy ghép chúng lại (vd: "IEMM.26/01, IEMM.26/02").
2. Xử lý Thiết Bị Nhiều Cụm (Đặc biệt là Máy điều hòa không khí gồm Khối trong nhà / Dàn lạnh / Indoor Unit và Khối ngoài trời / Dàn nóng / Outdoor Unit, hoặc Bộ nguồn và Thân máy):
   - Trích xuất mã model của từng cụm (nếu nhận diện được cụm dàn lạnh thì điền indoorModel, cụm dàn nóng thì điền outdoorModel).
   - Tổng hợp trường "model" chuẩn theo quy cách phòng thử nghiệm: ví dụ "[Model Bộ]" hoặc "[Model Dàn Lạnh] / [Model Dàn Nóng]" hoặc "[Model Tổng] (Dàn lạnh: [Model 1] / Dàn nóng: [Model 2])".
   - Tổng hợp thông số kỹ thuật (điện áp, tần số, công suất, dòng điện, công suất làm lạnh/sưởi ấm, môi chất lạnh).
 3. Trích xuất riêng "manufacturer" (Nhà sản xuất) và "countryOfOrigin" (Nước sản xuất / Made in). Nếu không có thông tin thì trả về chuỗi rỗng ""; trường "origin" chỉ giữ làm alias tương thích ngược.`;

        const parts: any[] = [{ text: promptText }];
        for (const img of imagesList) {
          const cleanB64 = img.includes(",") ? img.split(",")[1] : img;
          parts.push({
            inlineData: { data: cleanB64, mimeType: "image/jpeg" }
          });
        }

        const response = await generateContentWithRetryAndFallback(activeAi, {
          contents: [{ parts }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                brand: { type: Type.STRING, description: "Thương hiệu / Nhãn hiệu (Brand)" },
                model: { type: Type.STRING, description: "Kiểu loại / Mã Model tổng thể hoặc kết hợp" },
                indoorModel: { type: Type.STRING, description: "Mã model dàn lạnh / khối trong nhà (nếu có)" },
                outdoorModel: { type: Type.STRING, description: "Mã model dàn nóng / khối ngoài trời (nếu có)" },
                sealStamp: { type: Type.STRING, description: "Mã số tem niêm phong / niêm chì (nếu có)" },
                voltage: { type: Type.STRING, description: "Điện áp danh định (vd 220-240V, 220V~)" },
                frequency: { type: Type.STRING, description: "Tần số danh định (vd 50Hz, 50-60Hz)" },
                power: { type: Type.STRING, description: "Công suất danh định (vd 2000W, 1800W)" },
                current: { type: Type.STRING, description: "Dòng điện danh định (vd 8.5A, 10A)" },
                clockFreq: { type: Type.STRING, description: "Tần số xung nhịp lớn nhất (< 30MHz)" },
                coolingHeatingPower: { type: Type.STRING, description: "Công suất làm lạnh / sưởi ấm (nếu có)" },
                 manufacturer: { type: Type.STRING, description: "Nhà sản xuất (Manufacturer)" },
                 countryOfOrigin: { type: Type.STRING, description: "Nước sản xuất / Made in / Country of origin" },
                 origin: { type: Type.STRING, description: "Nguồn gốc / Made in / Xuất xứ; alias tương thích ngược" },
                 ipRating: { type: Type.STRING, description: "Chỉ số bảo vệ kháng nước IP (vd IPX0, IP25, IPX4)" }
               },
               required: ["brand", "model", "voltage", "frequency", "power", "current", "clockFreq", "manufacturer", "countryOfOrigin", "origin", "ipRating", "sealStamp"]
            }
          }
        }, preferredModel);
        return res.json({ text: response.text });
      }

      return res.status(400).json({ error: "Invalid action" });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return res.status(500).json({ error: String(error.message || error) });
    }
  });

  app.post("/api/upload-nas", async (req, res) => {
    try {
      const { buffer: base64Data, filename } = req.body;
      if (!base64Data || !filename) {
        return res.status(400).json({ error: "Thiếu dữ liệu tệp hoặc tên tệp" });
      }

      if (!process.env.FTP_HOST) {
        console.log("Mock FTP Upload success - Env FTP_HOST not defined.");
        return res.json({ success: true, mocked: true, message: "Lưu giả lập thành công (tệp .env chưa có NAS IP)" });
      }

      const buffer = Buffer.from(base64Data, "base64");
      const stream = Readable.from(buffer);

      const client = new FtpClient();
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        port: parseInt(process.env.FTP_PORT || "21"),
        secure: process.env.FTP_SECURE === "true",
      });

      await client.uploadFrom(stream, `/${filename}`);
      client.close();

      return res.json({ success: true, message: "Đã tải tệp lên NAS thành công" });
    } catch (error: any) {
      console.error("NAS FTP Upload Error:", error);
      return res.status(500).json({ error: String(error) });
    }
  });

  const httpServer = createHttpServer(app);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.use('/assets', (req, res) => {
      res.status(404).send('Asset not found');
    });

    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await initDbSchema();
  await scheduleAutoBackups();

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function scheduleAutoBackups() {
  const enabled = String(process.env.BACKUP_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log("Automatic backups disabled via BACKUP_ENABLED=false.");
    return;
  }
  if (!(await isPgToolAvailable())) {
    console.warn("pg_dump not found on PATH — automatic backups are disabled. Install PostgreSQL client tools to enable them.");
    return;
  }

  const intervalHours = Number(process.env.BACKUP_INTERVAL_HOURS || 24);
  const retentionCount = Number(process.env.BACKUP_RETENTION_COUNT || 14);
  const intervalMs = intervalHours * 60 * 60 * 1000;

  const runScheduledBackup = async () => {
    try {
      await createBackup("auto");
      applyRetention(retentionCount);
      console.log("Automatic backup completed.");
    } catch (error: any) {
      console.error("Automatic backup failed:", error?.message || error);
    }
  };

  const autoBackups = listBackups().filter(b => b.filename.startsWith("ddt_lab_auto_"));
  const latest = autoBackups[0];
  const isStale = !latest || (Date.now() - new Date(latest.createdAt).getTime()) >= intervalMs;

  if (isStale) {
    setTimeout(runScheduledBackup, 30 * 1000);
  }
  setInterval(runScheduledBackup, intervalMs);
}

startServer();


// --- End of server.ts ---

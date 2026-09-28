import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import PizZip from 'pizzip';
import sizeOf from 'image-size';
import { jsonError, jsonOk } from '@/lib/server/response';
import { buildReportDocxMetadata } from '@/lib/reportDocxMetadata';
import {
  buildReportDocxImageSlots,
  combineReportDocxLabelImages,
  getReportDocxLabelImages,
} from '@/lib/reportDocxImageMapping';
import { getDocxGraphSize } from '@/lib/reportDocxImageSizing';
import { preprocessImages } from '@/lib/server/report-docx';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      ocrData,
      testResults,
      standard,
      criteriaType,
      productPhoto1,
      productPhoto2,
      nameplatePhoto1,
      nameplatePhoto2,
      nameplatePhotos,
      reportMeta,
      emcData,
      dayCapDienData,
      subOptionTitle,
    } = body;

    const docxMetadata = buildReportDocxMetadata({ reportMeta, ocrData, emcData });

    if (emcData) {
      Object.keys(emcData).forEach((key) => {
        if (key.startsWith('table') && Array.isArray(emcData[key])) {
          emcData[key] = emcData[key].map((row: any) => ({
            ...row,
            Peak: row.peak || row.Peak || '',
          }));
        }
      });
    }

    let formattedTestDate = reportMeta?.testDate || '';
    if (formattedTestDate) {
      formattedTestDate = formattedTestDate
        .split(' – ')
        .map((d: string) => {
          if (!d) return '';
          const parts = d.split('-');
          if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return d;
        })
        .join(' – ');
    }

    let formattedSampleReceiptDate = reportMeta?.sampleReceiptDate || '';
    if (formattedSampleReceiptDate) {
      const parts = formattedSampleReceiptDate.split('-');
      if (parts.length === 3) {
        formattedSampleReceiptDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    const data: any = {
      reportNo: reportMeta?.reportNo || '',
      sampleName: reportMeta?.sampleName || '',
      deviceName: reportMeta?.deviceNameVi || standard?.name || '',
      deviceNameEn: reportMeta?.deviceNameEn || '',
      model: reportMeta?.model || '',
      codingNumber: docxMetadata.codingNumber,
      sealStamp: docxMetadata.sealStamp,
      brand: reportMeta?.brand || '',
      manufacturer: docxMetadata.manufacturer,
      countryOfOrigin: docxMetadata.countryOfOrigin,
      testerName: reportMeta?.testerName || '',
      managerName: reportMeta?.managerName || '',
      managerNam: reportMeta?.managerName || '',
      reportDate: docxMetadata.reportDate,
      sampleReceiptDate: formattedSampleReceiptDate,
      testDate: formattedTestDate,
      senderUnit: reportMeta?.senderUnit || '',
      senderAddress: reportMeta?.senderAddress || '',
      method: reportMeta?.testMethod ? (Array.isArray(reportMeta.testMethod) ? reportMeta.testMethod.join(', ') : reportMeta.testMethod) : '',
      standard: reportMeta?.evaluationStandard && reportMeta.evaluationStandard.length > 0 ? (Array.isArray(reportMeta.evaluationStandard) ? reportMeta.evaluationStandard.join(', ') : reportMeta.evaluationStandard) : standard?.standard || '',
      ...(emcData?.images || {}),
      nameplateImage: '',
      nameplateImage2: '',
      emcPower: docxMetadata.emcPower,
      emcVoltage: docxMetadata.emcVoltage,
      emcCurrent: docxMetadata.emcCurrent,
      emcFrequency: docxMetadata.emcFrequency,
      emcClockFreq: docxMetadata.emcClockFreq,
      emcAmbientTemp: emcData?.ambientTemp || '',
      emcAmbientHumidity: emcData?.ambientHumidity || '',
      emcImageLabel: emcData?.images?.label || '',
      emcImagePhaseL: emcData?.images?.phaseL || '',
      image_5_3_1: emcData?.images?.phaseL || '',
      emcImagePhaseN: emcData?.images?.phaseN || '',
      image_5_3_2: emcData?.images?.phaseN || '',
      emcImagePowerDist: emcData?.images?.powerDisturbance || '',
      image_6_3_1: emcData?.images?.powerDisturbance || '',

      emcImageDiscont: emcData?.images?.discontinuousPhaseN || '',
      image_7_3_1: emcData?.images?.discontinuousPhaseN || '',
      emcImageSample: emcData?.images?.sample || '',
      emcImageSetupVoltage: emcData?.images?.setupVoltage || '',
      emcImageSetupPower: emcData?.images?.setupPower || '',
      tablePhaseL: emcData?.tablePhaseL || [],

      isAirConNoLoad: subOptionTitle?.toLowerCase().includes('không có đầu nối tải') || false,

      table_6_3_1_1: subOptionTitle === 'Bếp từ 4 vùng nấu' || subOptionTitle === 'Bếp từ 3 vùng nấu' || subOptionTitle === 'Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại' || subOptionTitle === 'Bếp từ + hồng ngoại' || subOptionTitle === 'Bếp từ 2 vùng nấu' ? emcData.tableMag1_A || [] : (emcData?.tablePower || []).slice(0, 1),
      table_6_3_1_2: subOptionTitle === 'loại hai chiều' || standard?.id === 'emc_dieu_hoa' ? (emcData?.tablePowerDisturbance_indoor || []).slice(0, 1) : emcData.tableMag1_B || [],
      table_6_3_1_3: subOptionTitle === 'loại hai chiều' || standard?.id === 'emc_dieu_hoa' ? (emcData?.tablePowerDisturbance_outdoor || []).slice(0, 1) : emcData.tableMag1_C || [],
      table_6_3_2_1: subOptionTitle === 'Bếp từ 4 vùng nấu' || subOptionTitle === 'Bếp từ 3 vùng nấu' || subOptionTitle === 'Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại' || subOptionTitle === 'Bếp từ + hồng ngoại' || subOptionTitle === 'Bếp từ 2 vùng nấu' ? emcData.tableMag2_A || [] : (emcData?.tablePower_2 || []).slice(0, 1),
      table_6_3_2_2: subOptionTitle === 'loại hai chiều' || standard?.id === 'emc_dieu_hoa' ? (emcData?.tablePowerDisturbance_indoor_2 || []).slice(0, 1) : emcData.tableMag2_B || [],
      table_6_3_2_3: subOptionTitle === 'loại hai chiều' || standard?.id === 'emc_dieu_hoa' ? (emcData?.tablePowerDisturbance_outdoor_2 || []).slice(0, 1) : emcData.tableMag2_C || [],
      table_7_3_1_1: (emcData.tablePower || []).slice(0, 1),
      table_7_3_2_1: (emcData.tablePower_2 || []).slice(0, 1),
      table_5_3_1: emcData?.tablePhaseL || [],
      tablePhaseN: emcData?.tablePhaseN || [],
      table_5_3_2: emcData?.tablePhaseN || [],
      tablePower: (emcData?.tablePower || []).slice(0, 1),
      table_6_3_1: (emcData?.tablePower || []).slice(0, 1),
      image_5_3_1_1: emcData?.images?.phaseL || '',
      image_5_3_1_1_1: emcData?.images?.phaseL || '',
      table_5_3_1_1: emcData?.tablePhaseL || [],
      table_5_3_1_1_1: emcData?.tablePhaseL || [],
      image_5_3_1_2: emcData?.images?.phaseN || '',
      image_5_3_1_1_2: emcData?.images?.phaseN || '',
      table_5_3_1_2: emcData?.tablePhaseN || [],
      table_5_3_1_1_2: emcData?.tablePhaseN || [],
      image_5_3_1_2_1: emcData?.images?.phaseL_outdoor || '',
      table_5_3_1_2_1: emcData?.tablePhaseL_outdoor || [],
      image_5_3_1_2_2: emcData?.images?.phaseN_outdoor || '',
      table_5_3_1_2_2: emcData?.tablePhaseN_outdoor || [],
      image_5_3_1_2_3: emcData?.images?.phaseL_indoor || '',
      table_5_3_1_2_3: emcData?.tablePhaseL_indoor || [],
      image_5_3_1_2_4: emcData?.images?.phaseN_indoor || '',
      table_5_3_1_2_4: emcData?.tablePhaseN_indoor || [],
      image_5_3_1_2_5: (subOptionTitle?.toLowerCase().includes('không có đầu nối tải') ? emcData?.images?.PE_outdoor : emcData?.images?.S1_outdoor) || '',
      table_5_3_1_2_5: (subOptionTitle?.toLowerCase().includes('không có đầu nối tải') ? emcData?.tablePE_outdoor : emcData?.tableS1_outdoor) || [],
      image_5_3_1_2_6: (subOptionTitle?.toLowerCase().includes('không có đầu nối tải') ? emcData?.images?.PE_indoor : emcData?.images?.S1_indoor) || '',
      table_5_3_1_2_6: (subOptionTitle?.toLowerCase().includes('không có đầu nối tải') ? emcData?.tablePE_indoor : emcData?.tableS1_indoor) || [],
      image_5_3_1_2_7: emcData?.images?.PE_outdoor || '',
      table_5_3_1_2_7: emcData?.tablePE_outdoor || [],
      image_5_3_1_2_8: emcData?.images?.PE_indoor || '',
      table_5_3_1_2_8: emcData?.tablePE_indoor || [],
      image_6_3_1_1: subOptionTitle === 'Bếp từ 4 vùng nấu' || subOptionTitle === 'Bếp từ 3 vùng nấu' || subOptionTitle === 'Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại' || subOptionTitle === 'Bếp từ + hồng ngoại' || subOptionTitle === 'Bếp từ 2 vùng nấu' ? emcData?.images?.mag1_A || '' : emcData?.images?.powerDisturbance || '',
      image_6_3_1_2: subOptionTitle === 'loại hai chiều' || standard?.id === 'emc_dieu_hoa' ? emcData?.images?.powerDisturbance_indoor || '' : emcData?.images?.mag1_B || '',
      image_6_3_1_3: subOptionTitle === 'loại hai chiều' || standard?.id === 'emc_dieu_hoa' ? emcData?.images?.powerDisturbance_outdoor || '' : emcData?.images?.mag1_C || '',
      image_7_3_1_1: subOptionTitle === 'Bếp từ 4 vùng nấu' || subOptionTitle === 'Bếp từ 3 vùng nấu' || subOptionTitle === 'Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại' || subOptionTitle === 'Bếp từ + hồng ngoại' || subOptionTitle === 'Bếp từ 2 vùng nấu' ? emcData?.images?.powerDisturbance || '' : emcData?.images?.discontinuousPhaseN || '',
      image_8_3_1_1: emcData?.images?.discontinuousPhaseN || '',

      image_5_3_2_1: emcData?.images?.phaseL_2 || '',
      table_5_3_2_1: emcData?.tablePhaseL_2 || [],
      image_5_3_2_2: emcData?.images?.phaseN_2 || '',
      table_5_3_2_2: emcData?.tablePhaseN_2 || [],
      image_5_3_2_1_1: emcData?.images?.phaseL_2 || '',
      table_5_3_2_1_1: emcData?.tablePhaseL_2 || [],
      image_5_3_2_1_2: emcData?.images?.phaseN_2 || '',
      table_5_3_2_1_2: emcData?.tablePhaseN_2 || [],
      image_5_3_2_2_1: emcData?.images?.phaseL_outdoor_2 || '',
      table_5_3_2_2_1: emcData?.tablePhaseL_outdoor_2 || [],
      image_5_3_2_2_2: emcData?.images?.phaseN_outdoor_2 || '',
      table_5_3_2_2_2: emcData?.tablePhaseN_outdoor_2 || [],
      image_5_3_2_2_3: emcData?.images?.phaseL_indoor_2 || '',
      table_5_3_2_2_3: emcData?.tablePhaseL_indoor_2 || [],
      image_5_3_2_2_4: emcData?.images?.phaseN_indoor_2 || '',
      table_5_3_2_2_4: emcData?.tablePhaseN_indoor_2 || [],
      image_5_3_2_2_5: emcData?.images?.S1_outdoor_2 || '',
      table_5_3_2_2_5: emcData?.tableS1_outdoor_2 || [],
      image_5_3_2_2_6: emcData?.images?.S1_indoor_2 || '',
      table_5_3_2_2_6: emcData?.tableS1_indoor_2 || [],
      image_5_3_2_2_7: emcData?.images?.PE_outdoor_2 || '',
      table_5_3_2_2_7: emcData?.tablePE_outdoor_2 || [],
      image_5_3_2_2_8: emcData?.images?.PE_indoor_2 || '',
      table_5_3_2_2_8: emcData?.tablePE_indoor_2 || [],
      image_6_3_2_1: subOptionTitle === 'Bếp từ 4 vùng nấu' || subOptionTitle === 'Bếp từ 3 vùng nấu' || subOptionTitle === 'Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại' || subOptionTitle === 'Bếp từ + hồng ngoại' || subOptionTitle === 'Bếp từ 2 vùng nấu' ? emcData?.images?.mag2_A || '' : emcData?.images?.powerDisturbance_2 || '',
      image_6_3_2_2: subOptionTitle === 'loại hai chiều' || standard?.id === 'emc_dieu_hoa' ? emcData?.images?.powerDisturbance_indoor_2 || '' : emcData?.images?.mag2_B || '',
      image_6_3_2_3: subOptionTitle === 'loại hai chiều' || standard?.id === 'emc_dieu_hoa' ? emcData?.images?.powerDisturbance_outdoor_2 || '' : emcData?.images?.mag2_C || '',
      image_7_3_2_1: subOptionTitle === 'Bếp từ 4 vùng nấu' || subOptionTitle === 'Bếp từ 3 vùng nấu' || subOptionTitle === 'Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại' || subOptionTitle === 'Bếp từ + hồng ngoại' || subOptionTitle === 'Bếp từ 2 vùng nấu' ? emcData?.images?.powerDisturbance_2 || '' : emcData?.images?.discontinuousPhaseN_2 || '',
      image_8_3_2_1: emcData?.images?.discontinuousPhaseN_2 || '',

      image_5_3_3_1: emcData?.images?.phaseL_3 || '',
      table_5_3_3_1: emcData?.tablePhaseL_3 || [],
      image_5_3_3_2: emcData?.images?.phaseN_3 || '',
      table_5_3_3_2: emcData?.tablePhaseN_3 || [],
      image_7_3_3_1: emcData?.images?.powerDisturbance_3 || '',
      table_7_3_3_1: emcData?.tablePower_3 || [],
      image_8_3_3_1: emcData?.images?.discontinuousPhaseN_3 || '',
      table_6_3_3_1: emcData?.tableMag3_A || [],
      table_6_3_3_2: emcData?.tableMag3_B || [],
      table_6_3_3_3: emcData?.tableMag3_C || [],
      image_6_3_3_1: emcData?.images?.mag3_A || '',
      image_6_3_3_2: emcData?.images?.mag3_B || '',
      image_6_3_3_3: emcData?.images?.mag3_C || '',

      image_5_3_4_1: emcData?.images?.phaseL_4 || '',
      table_5_3_4_1: emcData?.tablePhaseL_4 || [],
      image_5_3_4_2: emcData?.images?.phaseN_4 || '',
      table_5_3_4_2: emcData?.tablePhaseN_4 || [],
      image_7_3_4_1: emcData?.images?.powerDisturbance_4 || '',
      table_7_3_4_1: emcData?.tablePower_4 || [],
      image_8_3_4_1: emcData?.images?.discontinuousPhaseN_4 || '',
      table_6_3_4_1: emcData?.tableMag4_A || [],
      table_6_3_4_2: emcData?.tableMag4_B || [],
      table_6_3_4_3: emcData?.tableMag4_C || [],
      image_6_3_4_1: emcData?.images?.mag4_A || '',
      image_6_3_4_2: emcData?.images?.mag4_B || '',
      image_6_3_4_3: emcData?.images?.mag4_C || '',
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
    Object.assign(
      data,
      buildReportDocxImageSlots({
        ...reportImageMappingInput,
        combinedLabelImage,
      }),
    );

    if (subOptionTitle === 'Bếp từ 1 vùng nấu') {
      data.image_5_3_1 = emcData?.images?.phaseL || '';
      data.image_5_3_2 = emcData?.images?.phaseN || '';
      data.image_6_3_1 = emcData?.images?.mag1_A || '';
      data.image_6_3_1_2 = emcData?.images?.mag1_B || '';
      data.image_6_3_3 = emcData?.images?.mag1_C || '';
      data.table_6_3_1 = emcData?.tableMag1_A || [];
      data.table_6_3_2 = emcData?.tableMag1_B || [];
      data.table_6_3_3 = emcData?.tableMag1_C || [];
      data.image_7_3_1 = emcData?.images?.powerDisturbance || '';
      data.table_7_3_1 = (emcData?.tablePower || []).slice(0, 1);
      data.image_8_3_1 = emcData?.images?.discontinuousPhaseN || '';
    }

    if (
      standard?.id === 'emc_may_giat' ||
      standard?.id === 'emc_may_hut_bui' ||
      standard?.id === 'emc_may_say_toc' ||
      standard?.id === 'emc_may_xay' ||
      standard?.id === 'emc_may_khoan'
    ) {
      data.image_6_3_1_1 = emcData?.images?.powerDisturbance || '';
      data.table_6_3_1_1 = (emcData?.tablePower || []).slice(0, 1);
      data.image_6_3_2_1 = emcData?.images?.powerDisturbance_2 || '';
      data.table_6_3_2_1 = (emcData?.tablePower_2 || []).slice(0, 1);

      if (subOptionTitle === 'Có chức năng sấy') {
        data.image_6_3_3_1 = emcData?.images?.powerDisturbance_3 || '';
        data.table_6_3_3_1 = (emcData?.tablePower_3 || []).slice(0, 1);
      }
    }

    if (testResults) {
      Object.keys(testResults).forEach((clauseId) => {
        const safeId = clauseId.replace(/\./g, '_');
        const entry = testResults[clauseId];
        data[`res_${safeId}`] = entry.result || '';
        data[`eval_${safeId}`] = entry.evaluation || '';

        if (entry.subData) {
          data[`t_${safeId}`] = entry.subData;

          if (!Array.isArray(entry.subData)) {
            if (entry.subData.ambient) data[`${safeId}_ambient`] = entry.subData.ambient;
            if (entry.subData.inputTemp) {
              data[`${safeId}_inputTemp`] = entry.subData.inputTemp;
              data[`${safeId}_sec_0_tempIn`] = entry.subData.inputTemp;
            }
            if (entry.subData.condition) data[`${safeId}_condition`] = entry.subData.condition;
            if (entry.subData.workFollow && safeId !== '19') data[`${safeId}_workFollow`] = entry.subData.workFollow;

            if (entry.subData.rows && Array.isArray(entry.subData.rows)) {
              data['table_' + safeId + '_rows'] = entry.subData.rows;
              entry.subData.rows.forEach((row: any, i: number) => {
                data[`${safeId}_row_${i}_name`] = row.name || '';
                data[`${safeId}_row_${i}_unit`] = row.unit || '';
                data[`${safeId}_row_${i}_res`] = row.result || '';
                data[`${safeId}_row_${i}_lim`] = row.limit || '';
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
                    data[`${safeId}_sec_${i}_row_${j}_name`] = subRow.name || '';
                    data[`${safeId}_sec_${i}_row_${j}_unit`] = subRow.unit || '';
                    data[`${safeId}_sec_${i}_row_${j}_res`] = subRow.result || '';
                    data[`${safeId}_sec_${i}_row_${j}_lim`] = subRow.limit || '';
                  });
                }
              } else {
                data[`${safeId}_row_${i}_cond`] = row.cond || '';
                data[`${safeId}_row_${i}_nom`] = row.nominal || '';
                data[`${safeId}_row_${i}_unit`] = row.unit || '';
                data[`${safeId}_row_${i}_res`] = row.result || '';
                data[`${safeId}_row_${i}_lim`] = row.limit || '';
                data[`${safeId}_row_${i}_dev`] = row.dev || '';
                data[`${safeId}_row_${i}_name`] = row.name || '';

                tableArray.push({
                  cond: row.cond || '',
                  nom: row.nominal || '',
                  unit: row.unit || '',
                  res: row.result || '',
                  result: row.result || '',
                  lim: row.limit || '',
                  limit: row.limit || '',
                  dev: row.dev || '',
                  name: row.name || '',
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

    let templateFile = criteriaType === 'reduced' ? '5699-2-9 placeholder 4.docx' : '5699-2-9 placeholder.docx';

    if (standard?.standard === 'TCVN 5699-2-3') {
      templateFile = criteriaType === 'reduced' ? '5699-2-3 placeholder 4.docx' : '5699-2-3 placeholder.docx';
    } else if (standard?.standard === 'TCVN 5699-2-15') {
      templateFile = criteriaType === 'reduced' ? '5699-2-15 placeholder 4.docx' : '5699-2-15 placeholder.docx';
    } else if (standard?.standard === 'TCVN 5699-2-80') {
      templateFile = criteriaType === 'reduced' ? '5699-2-80 placeholder 4.docx' : '5699-2-80 placeholder.docx';
    } else if (standard?.standard === 'TCVN 5699-2-21') {
      templateFile = criteriaType === 'reduced' ? '5699-2-21 placeholder 4.docx' : '5699-2-21 placeholder.docx';
    } else if (standard?.standard === 'TCVN 5699-2-23') {
      templateFile = criteriaType === 'reduced' ? '5699-2-23 placeholder 4.docx' : '5699-2-23 placeholder.docx';
    } else if (standard?.standard === 'TCVN 5699-2-35') {
      templateFile = criteriaType === 'reduced' ? '5699-2-35 placeholder 4.docx' : '5699-2-35 placeholder.docx';
    } else if (standard?.standard === 'TCVN 5699-2-25') {
      templateFile = criteriaType === 'reduced' ? '5699-2-25 placeholder 4.docx' : '5699-2-25 placeholder.docx';
    } else if (standard?.id === 'emc_dung_cu_dien_dun_nuoc_nong') {
      templateFile = 'DCDNNTT placeholder.docx';
    } else if (standard?.id === 'emc_tu_lanh') {
      templateFile = 'tulanh placeholder.docx';
    } else if (subOptionTitle === 'Bếp từ 1 vùng nấu') {
      templateFile = '1T placeholder.docx';
    } else if (subOptionTitle === 'Bếp điện 1 vùng nấu') {
      templateFile = 'bepdien1vungnau placeholder.docx';
    } else if (subOptionTitle === 'Bếp điện 2 vùng nấu') {
      templateFile = 'bepdien2vungnau placeholder.docx';
    } else if (subOptionTitle === 'Bếp từ 4 vùng nấu') {
      templateFile = '4T placeholder.docx';
    } else if (subOptionTitle === 'Bếp từ 3 vùng nấu') {
      templateFile = '3T placeholder.docx';
    } else if (subOptionTitle === 'Bếp từ 2 vùng nấu + 1 vùng nấu hồng ngoại') {
      templateFile = '2T1HN placeholder.docx';
    } else if (subOptionTitle === 'Bếp từ 2 vùng nấu') {
      templateFile = '2T placeholder.docx';
    } else if (subOptionTitle === 'Bếp từ + hồng ngoại') {
      templateFile = '1T1HN placeholder.docx';
    } else if (subOptionTitle === 'loại hai chiều') {
      templateFile = 'loai2chieu placeholder.docx';
    } else if (subOptionTitle?.toLowerCase().includes('1 khối-loại hai chiều')) {
      templateFile = '1khoiloai2chieu placeholder.docx';
    } else if (subOptionTitle?.toLowerCase().includes('1 khối-loại một chiều')) {
      templateFile = '1khoiloai1chieu placeholder.docx';
    } else if (subOptionTitle?.toLowerCase().includes('một chiều-không có đầu nối tải')) {
      templateFile = 'loai1chieuKCDNT placeholder.docx';
    } else if (subOptionTitle?.toLowerCase().includes('một chiều')) {
      templateFile = 'loai1chieu placeholder.docx';
    } else if (standard?.id === 'emc_may_giat') {
      if (subOptionTitle === 'Có chức năng sấy') {
        templateFile = 'MGCS placeholder.docx';
      } else if (subOptionTitle === 'Không có chức năng sấy') {
        templateFile = 'MGKCS placeholder.docx';
      }
    } else if (standard?.id === 'emc_may_hut_bui') {
      if (subOptionTitle === 'Có dùng tay giả') {
        templateFile = 'MHBCTG placeholder.docx';
      } else if (subOptionTitle === 'Không dùng tay giả') {
        templateFile = 'MHBKTG placeholder.docx';
      }
    } else if (standard?.id === 'emc_may_say_toc') {
      templateFile = 'maysaytoc placeholder.docx';
    } else if (standard?.id === 'emc_may_xay') {
      if (subOptionTitle === 'Có dùng tay giả') {
        templateFile = 'MXCTG placeholder.docx';
      } else if (subOptionTitle === 'Không dùng tay giả') {
        templateFile = 'MXKTG placeholder.docx';
      }
    } else if (standard?.id === 'emc_may_khoan') {
      templateFile = 'maykhoan placeholder.docx';
    } else if (standard?.id === 'day_cap_dien') {
      if (criteriaType === 'reduced') {
        templateFile = 'daycapdien 4 placeholder.docx';
      } else {
        templateFile = 'daycapdien placeholder.docx';
      }
    }

    const templatePath = path.join(process.cwd(), 'public', templateFile);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`No template file found in public directory. Looking for: ${templateFile}`);
    }

    const content = fs.readFileSync(templatePath);
    if (!content || content.length === 0) {
      throw new Error(`Template file ${templateFile} is empty.`);
    }

    const zip = new PizZip(content);

    const imageOptions = {
      centered: false,
      getImage: (tagValue: string) => {
        if (!tagValue || typeof tagValue !== 'string') return null;
        let base64 = tagValue;
        if (base64.includes(',')) {
          base64 = base64.split(',')[1];
        }
        try {
          return Buffer.from(base64, 'base64');
        } catch (e) {
          console.error('Image decode error:', e);
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
          } catch {
            // fallback size
          }

          const isEmcChart = Boolean(
            tagName && (
              tagName.startsWith('emcImage') ||
              tagName.startsWith('image_') ||
              tagName.startsWith('graph_') ||
              tagName.startsWith('chart_') ||
              tagName.toLowerCase().includes('emc') ||
              (emcData?.images && (tagName in emcData.images || Object.values(emcData.images).includes(tagValue)))
            ),
          );

          if (isEmcChart) {
            return getDocxGraphSize(w, h);
          }

          let MAX_WIDTH = 560;
          let MAX_HEIGHT = 580;

          if (tagName === 'anh_6') {
            MAX_WIDTH = 560;
            MAX_HEIGHT = 350;
          } else if (tagName && tagName.startsWith('anh_')) {
            MAX_WIDTH = 450;
            MAX_HEIGHT = 280;
          } else if (tagName && tagName.startsWith('productImage')) {
            const hasBothProduct = Boolean(body.productPhoto1 && body.productPhoto2);
            const hasAnyNameplate = Boolean(body.nameplatePhoto1 || body.nameplatePhoto2);
            MAX_WIDTH = hasBothProduct ? 315 : 620;
            MAX_HEIGHT = hasAnyNameplate ? 392 : 620;
          } else if (tagName && tagName.startsWith('nameplateImage')) {
            const hasBothNameplate = Boolean(body.nameplatePhoto1 && body.nameplatePhoto2);
            const hasAnyProduct = Boolean(body.productPhoto1 || body.productPhoto2);
            MAX_WIDTH = hasBothNameplate ? 315 : 620;
            MAX_HEIGHT = hasAnyProduct ? 392 : 620;
          }

          const ratio = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h);
          const finalW = Math.round(w * ratio);
          const finalH = Math.round(h * ratio);

          return [finalW, finalH];
        } catch (err) {
          console.error('Error getting image size:', err);
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
        return '';
      },
    });

    const allNameplates: string[] = Array.isArray(nameplatePhotos) && nameplatePhotos.length > 0
      ? nameplatePhotos.filter(Boolean)
      : [nameplatePhoto1, nameplatePhoto2].filter(Boolean);

    data.productImage1 = productPhoto1 || '';
    data.productImage = productPhoto1 || '';
    data.productImage2 = productPhoto2 || '';
    data.nameplateImage1 = allNameplates[0] || nameplatePhoto1 || '';
    data.nameplateImage = allNameplates[0] || nameplatePhoto1 || '';
    data.nameplateImage2 = allNameplates[1] || nameplatePhoto2 || '';
    data.nameplateImage3 = allNameplates[2] || '';
    data.nameplateImage4 = allNameplates[3] || '';
    data.nameplateImages = allNameplates.map((img, idx) => ({ image: img, index: idx + 1 }));

    if (dayCapDienData && dayCapDienData.items) {
      Object.keys(dayCapDienData.items).forEach((key) => {
        const flatKey = key.replace('.', '_');
        data[`muc_${flatKey}`] = dayCapDienData.items[key].limit;
        data[`kq_${flatKey}`] = dayCapDienData.items[key].result;
      });
      data.donvi_4_3 = dayCapDienData.dropdown4_3 === 'Điện trở cách điện' ? 'MΩ.km' : 'Ω.cm';
      data.muc_4_3_label = dayCapDienData.dropdown4_3;
    }

    await preprocessImages(data);

    doc.render(data);

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const b64 = buf.toString('base64');
    return jsonOk({ base64: b64, filename: `Report_${reportMeta?.sampleName || 'Device'}.docx` });
  } catch (error) {
    console.error('Gen DOCX Error:', error);
    return jsonError(String(error), 500);
  }
}

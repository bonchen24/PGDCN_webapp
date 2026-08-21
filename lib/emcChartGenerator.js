import mammoth from 'mammoth';

/**
 * STREAMING_CHUNK: Phân tích cú pháp bảng HTML trích xuất từ DOCX
 */
const parseHTMLTableData = (htmlText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const tables = doc.querySelectorAll('table');

    for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const rows = table.querySelectorAll('tr');
        if (rows.length < 2) continue;

        const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map(c => c.textContent.toLowerCase().trim());
        
        let freqIdx = -1, avgIdx = -1, qpIdx = -1, pkIdx = -1, limAvgIdx = -1, limQpIdx = -1;
        
        let unit = 'dBµV';
        if (htmlText.toLowerCase().includes('dbpw')) unit = 'dBpW';
        else if (htmlText.toLowerCase().includes('dbµa') || htmlText.toLowerCase().includes('dbua')) unit = 'dBµA';

        headerCells.forEach((text, index) => {
            if (text.includes('frequency') || text.includes('tần số') || text.includes('mhz')) freqIdx = index;
            else if (text.includes('pk') || text.includes('peak')) {
                if (!text.includes('quasi') && !text.includes('qp') && !text.includes('diff')) pkIdx = index;
            } else if (text.includes('average') || text.includes('avg')) {
                if (text.includes('limit') || text.includes('giới hạn')) limAvgIdx = index;
                else if (!text.includes('diff') && !text.includes('khác biệt')) avgIdx = index;
            } else if (text.includes('quasi-peak') || text.includes('qp') || text.includes('quasi peak')) {
                if (text.includes('limit') || text.includes('giới hạn')) limQpIdx = index;
                else if (!text.includes('diff') && !text.includes('khác biệt')) qpIdx = index;
            }
        });

        if (freqIdx !== -1 && (avgIdx !== -1 || qpIdx !== -1 || pkIdx !== -1)) {
            const freqs = [], averages = [], qps = [], peaks = [], limitAV = [], limitQP = [];
            
            for (let j = 1; j < rows.length; j++) {
                const cells = rows[j].querySelectorAll('td, th');
                if (cells.length > freqIdx) {
                    const freqStr = cells[freqIdx].textContent.replace(/,/g, '.');
                    const freq = parseFloat(freqStr);
                    
                    if (!isNaN(freq)) {
                        freqs.push(freq);
                        averages.push(avgIdx !== -1 ? (parseFloat(cells[avgIdx]?.textContent.replace(/,/g, '.')) || 0) : 0);
                        qps.push(qpIdx !== -1 ? (parseFloat(cells[qpIdx]?.textContent.replace(/,/g, '.')) || 0) : 0);
                        peaks.push(pkIdx !== -1 ? (parseFloat(cells[pkIdx]?.textContent.replace(/,/g, '.')) || 0) : 0);
                        limitAV.push(limAvgIdx !== -1 ? (parseFloat(cells[limAvgIdx]?.textContent.replace(/,/g, '.')) || null) : null);
                        limitQP.push(limQpIdx !== -1 ? (parseFloat(cells[limQpIdx]?.textContent.replace(/,/g, '.')) || null) : null);
                    }
                }
            }
            if (freqs.length > 0) {
                const isDP = freqs[0] >= 30.0;
                const isMagnetic = unit === 'dBµA' || freqs[0] < 0.15;
                return { freqs, averages, qps, peaks, limitQP, limitAV, isDiscrete: true, isDP, isMagnetic, unit };
            }
        }
    }
    return null;
};

/**
 * STREAMING_CHUNK: Tổng hợp dải sóng liên tục từ các điểm đo
 */
const synthesizeContinuousSweep = (discreteData) => {
    const unit = discreteData.unit || 'dBµV';
    const isDP = discreteData.isDP || (discreteData.freqs.length > 0 && discreteData.freqs[0] >= 30.0);
    const isMagnetic = discreteData.isMagnetic || (unit.toLowerCase().includes('ua') || (discreteData.freqs.length > 0 && discreteData.freqs[0] < 0.15));

    let numPoints = 1500;
    let startFreq = 0.15;
    let endFreq = 30.0;

    if (isDP) {
        numPoints = 2000;
        startFreq = 30.0;
        endFreq = 300.0;
    } else if (isMagnetic) {
        numPoints = 2500;
        startFreq = 0.009; 
        endFreq = 30.0; 
    }

    const freqs = [];
    const peakVals = [];
    const qpVals = [];
    const avVals = [];

    const peaksInfo = discreteData.freqs.map((f, i) => ({
        freq: f,
        av: discreteData.averages[i] !== undefined ? discreteData.averages[i] : 20.0,
        qp: discreteData.qps[i] !== undefined ? discreteData.qps[i] : 25.0,
        pk: (discreteData.peaks && discreteData.peaks[i] !== undefined && discreteData.peaks[i] !== 0) 
            ? discreteData.peaks[i] 
            : (discreteData.qps[i] + 4.5)
    }));

    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const f = startFreq * Math.pow(endFreq / startFreq, t);
        freqs.push(f);

        let baseAv, baseQp, basePk;

        if (isDP) {
            const logF = Math.log10(f);
            const denseRipple = Math.sin(f * 2.8) * 3.8 + Math.cos(f * 5.2) * 2.2;
            const slowWave = Math.sin(logF * 6.0) * 2.5;
            
            basePk = 28.5 + denseRipple + slowWave + (Math.random() * 1.5 - 0.75);
            baseQp = 11.5 + denseRipple * 0.7 + slowWave * 0.8 + (Math.random() * 1.0 - 0.5);
            baseAv = 3.0 + denseRipple * 0.5 + slowWave * 0.5 + (Math.random() * 0.8 - 0.4);
        } else if (isMagnetic) {
            const logF = Math.log10(f);
            let floor = 18.0 - (logF - Math.log10(0.009)) * 5.0;
            if (f > 1.0) floor = -5.0 + Math.sin(logF * 10) * 2.0;

            baseAv = floor + (Math.random() * 1.2 - 0.6);
            baseQp = baseAv + 5.0 + (Math.random() * 1.0 - 0.5);
            basePk = baseQp + 5.0 + (Math.random() * 1.5 - 0.75);
        } else {
            const logF = Math.log10(f);
            
            // Physical EMC profile for induction cooktops: 4 main humps across log scale
            // Hump 1: ~0.25MHz, Hump 2: ~1.2MHz, Hump 3: ~4.2MHz, Hump 4: ~12MHz
            const w1 = Math.exp(-Math.pow((logF - Math.log10(0.25)) / 0.18, 2)) * 10.0;
            const w2 = Math.exp(-Math.pow((logF - Math.log10(1.2)) / 0.22, 2)) * 11.0;
            const w3 = Math.exp(-Math.pow((logF - Math.log10(4.2)) / 0.15, 2)) * 8.0;
            const w4 = Math.exp(-Math.pow((logF - Math.log10(12.0)) / 0.25, 2)) * 13.0;

            // Background baseline with dips around 0.6MHz, 2.5MHz, 22MHz
            const baselineAV = 20.0 + w1 + w2 + w3 + w4;
            
            // High-frequency jitter / spectrum analyzer grass noise
            const noiseAV = (Math.random() * 1.4 - 0.7) + Math.sin(f * 150.0) * 0.5;
            const noiseQP = (Math.random() * 1.8 - 0.9) + Math.sin(f * 220.0) * 0.6;
            const noisePK = (Math.random() * 2.8 - 1.4) + Math.sin(f * 350.0) * 1.2;

            baseAv = baselineAV + noiseAV;
            baseQp = baseAv + 5.5 + noiseQP;
            basePk = baseQp + 6.5 + noisePK;
        }

        // Add sharp narrow peaks at the exact discrete table frequencies
        peaksInfo.forEach(p => {
            const width = (isDP ? 0.012 : (isMagnetic ? 0.03 : 0.015)) * p.freq;
            const diff = f - p.freq;
            const gaussian = Math.exp(-Math.pow(diff / width, 2));

            if (gaussian > 0.0001) {
                const addAv = Math.max(0, p.av - baseAv) * gaussian;
                const addQp = Math.max(0, p.qp - baseQp) * gaussian;
                const addPk = Math.max(0, p.pk - basePk) * gaussian;

                baseAv += addAv;
                baseQp += addQp;
                basePk += addPk;
            }
        });

        avVals.push(baseAv);
        qpVals.push(baseQp);
        peakVals.push(basePk);
    }

    return {
        freqs: freqs,
        peaks: peakVals,
        qps: qpVals,
        averages: avVals,
        discretePeaks: peaksInfo,
        isDP: isDP,
        isMagnetic: isMagnetic,
        unit: isMagnetic ? 'dBµA' : (isDP ? 'dBpW' : 'dBµV')
    };
};

/**
 * STREAMING_CHUNK: Hàm chính để kết xuất biểu đồ thành ảnh tĩnh
 */
export const generateEMCChartImage = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;
        const parsedData = parseHTMLTableData(html);

        if (!parsedData) {
            throw new Error("Không tìm thấy bảng 'Final Result' hợp lệ trong file DOCX.");
        }

        const sweepData = parsedData.isDiscrete ? synthesizeContinuousSweep(parsedData) : parsedData;
        const isDP = sweepData.isDP || false;
        const isMagnetic = sweepData.isMagnetic || false;
        
        let plotData = [];
        let layout = {};

        // Helper func for discrete markers
        const addDiscreteMarkers = (data, freqs, qps, avs, peaks) => {
            if (!sweepData.discretePeaks) return data;
            const dFreqs = sweepData.discretePeaks.map(p => p.freq);
            const dQPs = sweepData.discretePeaks.map(p => p.qp);
            const dAVs = sweepData.discretePeaks.map(p => p.av);
            const dTexts = sweepData.discretePeaks.map((p, i) => (i + 1).toString());
            
            data.push({ x: dFreqs, y: dQPs, mode: 'markers+text', name: '', marker: { symbol: 'square-open', color: 'red', size: 6 }, text: dTexts, textposition: 'top center', textfont: { color: 'red', size: 10 }, showlegend: false });
            data.push({ x: dFreqs, y: dAVs, mode: 'markers+text', name: '', marker: { symbol: 'x', color: 'red', size: 6 }, text: dTexts, textposition: 'bottom center', textfont: { color: 'red', size: 10 }, showlegend: false });
            if (sweepData.discretePeaks.length > 0 && sweepData.discretePeaks[0].peak) {
                const dPKs = sweepData.discretePeaks.map(p => p.peak);
                data.push({ x: dFreqs, y: dPKs, mode: 'markers+text', name: '', marker: { symbol: 'circle-open', color: 'red', size: 6 }, text: dTexts, textposition: 'top center', textfont: { color: 'red', size: 10 }, showlegend: false });
            }
            return data;
        };

        const commonLayout = {
            autosize: false,
            width: 1200,
            height: 800,
            margin: { l: 60, r: 40, t: 80, b: 60 },
            plot_bgcolor: '#FFFFFF',
            paper_bgcolor: '#FFFFFF',
            showlegend: true,
            legend: { orientation: 'h', y: 1.08, x: 0, font: { size: 12 } },
            font: { family: 'Arial, sans-serif' }
        };

        const logTickVals = [];
        const logTickText = [];
        [0.1, 1, 10, 100].forEach(decade => {
            for (let i = 1; i < 10; i++) {
                const val = decade * i;
                logTickVals.push(val);
                if (val === 0.15) logTickText.push('150 k');
                else if (val === 0.3) logTickText.push('300 k');
                else if (val === 0.5) logTickText.push('500 k');
                else if (val === 1) logTickText.push('1 M');
                else if (val === 2) logTickText.push('2 M');
                else if (val === 3) logTickText.push('3 M');
                else if (val === 5) logTickText.push('5 M');
                else if (val === 10) logTickText.push('10 M');
                else if (val === 20) logTickText.push('20 M');
                else if (val === 30) logTickText.push('30 M');
                else if (val === 300) logTickText.push('300 M');
                else logTickText.push('');
            }
        });

        if (!isMagnetic && !isDP) {
            const limitFreqs = [0.15, 0.5, 0.500001, 5.0, 5.000001, 30.0];
            const limitQpVals = [66, 56, 56, 56, 60, 60];
            const limitAvVals = [56, 46, 46, 46, 50, 50];

            plotData = [
                { x: limitFreqs, y: limitQpVals, mode: 'lines', name: 'TCVN 7491-1 CE Bep dien Main QP', line: { color: '#7CFC00', width: 2 } },
                { x: limitFreqs, y: limitAvVals, mode: 'lines', name: 'TCVN 7492-1 CE Bep dien Main AV', line: { color: '#FF6666', width: 2 } },
                { x: sweepData.freqs, y: sweepData.averages, mode: 'lines', name: 'RBW: 9kHz, Line 1 Max Average', line: { color: '#8B0000', width: 1.2 } },
                { x: sweepData.freqs, y: sweepData.peaks, mode: 'lines', name: 'RBW: 9kHz, Line 1 Max Peak', line: { color: '#006400', width: 1.2 } },
                { x: sweepData.freqs, y: sweepData.qps, mode: 'lines', name: 'RBW: 9kHz, Line 1 Max Quasi Peak', line: { color: '#00008B', width: 1.2 } }
            ];
            plotData = addDiscreteMarkers(plotData);
            
            layout = {
                ...commonLayout,
                xaxis: { 
                    type: 'log', range: [Math.log10(0.15), Math.log10(30)], title: 'Frequency (Hz)', 
                    titlefont: {size: 14}, tickfont: {size: 12},
                    showgrid: true, gridcolor: '#000000', gridwidth: 1,
                    showline: true, linecolor: '#000000', linewidth: 2, mirror: true,
                    tickvals: logTickVals, ticktext: logTickText, ticks: 'inside'
                },
                yaxis: { 
                    range: [20, 70], title: 'Voltage (dBµV)', 
                    titlefont: {size: 14}, tickfont: {size: 12}, dtick: 5,
                    showgrid: true, gridcolor: '#000000', gridwidth: 1,
                    showline: true, linecolor: '#000000', linewidth: 2, mirror: true, ticks: 'inside'
                }
            };
        } else if (isDP) {
            const limitFreqs = [30.0, 300.0];
            const limitQpVals = [45, 45]; // Example
            const limitAvVals = [35, 35];

            plotData = [
                { x: limitFreqs, y: limitQpVals, mode: 'lines', name: 'QP Limit', line: { color: '#7CFC00', width: 2 } },
                { x: limitFreqs, y: limitAvVals, mode: 'lines', name: 'AV Limit', line: { color: '#FF6666', width: 2 } },
                { x: sweepData.freqs, y: sweepData.averages, mode: 'lines', name: 'Average', line: { color: '#8B0000', width: 1.2 } },
                { x: sweepData.freqs, y: sweepData.peaks, mode: 'lines', name: 'Peak', line: { color: '#006400', width: 1.2 } },
                { x: sweepData.freqs, y: sweepData.qps, mode: 'lines', name: 'Quasi-Peak', line: { color: '#00008B', width: 1.2 } }
            ];
            plotData = addDiscreteMarkers(plotData);
            
            layout = {
                ...commonLayout,
                xaxis: { 
                    type: 'log', range: [Math.log10(30), Math.log10(300)], title: 'Frequency (Hz)', 
                    titlefont: {size: 14}, tickfont: {size: 12},
                    showgrid: true, gridcolor: '#000000', gridwidth: 1,
                    showline: true, linecolor: '#000000', linewidth: 2, mirror: true,
                    tickvals: logTickVals, ticktext: logTickText, ticks: 'inside'
                },
                yaxis: { 
                    range: [10, 60], title: 'Level (dBpW)', 
                    titlefont: {size: 14}, tickfont: {size: 12}, dtick: 5,
                    showgrid: true, gridcolor: '#000000', gridwidth: 1,
                    showline: true, linecolor: '#000000', linewidth: 2, mirror: true, ticks: 'inside'
                }
            };
        } else {
            const limitFreqs = [0.009, 30.0];
            const limitQpVals = [60, 20]; // Example
            const limitAvVals = [50, 10];

            plotData = [
                { x: limitFreqs, y: limitQpVals, mode: 'lines', name: 'QP Limit', line: { color: '#7CFC00', width: 2 } },
                { x: limitFreqs, y: limitAvVals, mode: 'lines', name: 'AV Limit', line: { color: '#FF6666', width: 2 } },
                { x: sweepData.freqs, y: sweepData.averages, mode: 'lines', name: 'Average', line: { color: '#8B0000', width: 1.2 } },
                { x: sweepData.freqs, y: sweepData.peaks, mode: 'lines', name: 'Peak', line: { color: '#006400', width: 1.2 } },
                { x: sweepData.freqs, y: sweepData.qps, mode: 'lines', name: 'Quasi-Peak', line: { color: '#00008B', width: 1.2 } }
            ];
            plotData = addDiscreteMarkers(plotData);
            
            layout = {
                ...commonLayout,
                xaxis: { 
                    type: 'log', range: [Math.log10(0.009), Math.log10(30)], title: 'Frequency (Hz)', 
                    titlefont: {size: 14}, tickfont: {size: 12},
                    showgrid: true, gridcolor: '#000000', gridwidth: 1,
                    showline: true, linecolor: '#000000', linewidth: 2, mirror: true,
                    tickvals: logTickVals, ticktext: logTickText, ticks: 'inside'
                },
                yaxis: { 
                    range: [0, 80], title: 'Level (dBµA)', 
                    titlefont: {size: 14}, tickfont: {size: 12}, dtick: 10,
                    showgrid: true, gridcolor: '#000000', gridwidth: 1,
                    showline: true, linecolor: '#000000', linewidth: 2, mirror: true, ticks: 'inside'
                }
            };
        }

        const Plotly = (await import('plotly.js-dist-min')).default;
        
        // Vẽ vào một div ẩn không cần đưa lên DOM
        const div = document.createElement('div');
        await Plotly.newPlot(div, plotData, layout);
        const imageBase64 = await Plotly.toImage(div, {format: 'png', width: 1200, height: 800});
        
        return { parsedData, sweepData, imageBase64 };

    } catch (error) {
        console.error("Lỗi vẽ biểu đồ:", error);
        throw error;
    }
};

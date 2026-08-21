// Author: Gemini
// OS support: Web/Node
// Description: Form hiển thị kết quả thử nghiệm theo các tiêu chuẩn mặc định

import React from 'react';
import { ApplianceStandard } from '../lib/standards';

interface DefaultStandardFormProps {
  selectedStandard: ApplianceStandard;
  criteriaType: 'full' | 'reduced' | null;
  testResults: Record<string, any>;
  setTestResults: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

export default function DefaultStandardForm({
  selectedStandard,
  criteriaType,
  testResults,
  setTestResults
}: DefaultStandardFormProps) {

const cycleEvaluation = (clauseId: string) => {
    setTestResults(prev => {
      const current = prev[clauseId]?.evaluation || 'N/A';
      let nextEval = 'N/A';
      if (current === 'N/A') nextEval = 'Đạt';
      else if (current === 'Đạt') nextEval = 'Không đạt';
      else nextEval = 'N/A';
      return { ...prev, [clauseId]: { ...prev[clauseId], evaluation: nextEval } };
    });
  }

const handleResultChange = (clauseId: string, field: 'result' | 'evaluation', value: string) => {
    setTestResults(prev => {
      const next: any = { ...prev };
      
      next[clauseId] = { ...next[clauseId], [field]: value };
      
        if (field === 'result' && (clauseId === '7.1_3' || clauseId === '7.1_4') && selectedStandard) {
        const powerClauseDef = selectedStandard.clauses.find(c => c.subTable === 'POWER_AND_CURRENT');
        if (powerClauseDef && next[powerClauseDef.id] && Array.isArray(next[powerClauseDef.id].subData)) {
          const tId = powerClauseDef.id;
          const updatedSubData = [...next[tId].subData];
          const rowIndex = clauseId === '7.1_3' ? 0 : 1;
          
          updatedSubData[rowIndex] = { ...updatedSubData[rowIndex], nominal: value || '-' };
          
          const nominalNum = parseFloat(String(value || '').replace(',', '.'));
          const resultNum = parseFloat(String(updatedSubData[rowIndex].result || '').replace(',', '.'));
          if (!isNaN(nominalNum) && !isNaN(resultNum) && nominalNum !== 0) {
             const dev = ((resultNum - nominalNum) / nominalNum) * 100;
             const devFormatted = dev.toFixed(1).replace('.', ',');
             updatedSubData[rowIndex].dev = dev > 0 ? `+${devFormatted}` : devFormatted;
          } else {
             updatedSubData[rowIndex].dev = '-';
          }
          next[tId] = { ...next[tId], subData: updatedSubData };
        }
      }
      return next;
    });
  }

const handleSubDataChange = (clauseId: string, rowIndex: number, field: string, value: string, subField?: string, sectionIndex?: number, selectIndex?: number) => {
    setTestResults(prev => {
      const next: any = { ...prev };
      const clause = { ...next[clauseId] };
      const activeSubTable = clause.subTable || selectedStandard?.clauses.find((c: any) => c.id === clauseId)?.subTable;
      let subData = Array.isArray(clause.subData) ? [...clause.subData] : { ...clause.subData };
      
      if (activeSubTable === 'CREEPAGE_CLEARANCE' || activeSubTable === 'HEAT_FIRE' || activeSubTable === 'CLAUSE_22_35') {
        const section = { ...subData[sectionIndex!] };
        const rows = [...section.rows];
        rows[rowIndex] = { ...rows[rowIndex], [field]: value };
        section.rows = rows;
        subData[sectionIndex!] = section;
      } else if (Array.isArray(subData)) {
        subData[rowIndex] = { ...subData[rowIndex], [field]: value };
        
        if (activeSubTable === 'POWER_AND_CURRENT' && field === 'cond') {
           if (rowIndex % 2 === 0 && rowIndex + 1 < subData.length) {
              subData[rowIndex + 1] = { ...subData[rowIndex + 1], cond: value };
           } else if (rowIndex % 2 !== 0 && rowIndex - 1 >= 0) {
              subData[rowIndex - 1] = { ...subData[rowIndex - 1], cond: value };
           }
        }
        
        if (activeSubTable === 'POWER_AND_CURRENT' && (field === 'nominal' || field === 'result')) {
          const nomStr = String(subData[rowIndex].nominal || '');
          const resStr = String(subData[rowIndex].result || '');
          const nominal = parseFloat(nomStr.replace(',', '.'));
          const result = parseFloat(resStr.replace(',', '.'));
          if (!isNaN(nominal) && !isNaN(result) && nominal !== 0) {
            const dev = ((result - nominal) / nominal) * 100;
            const devFormatted = dev.toFixed(1).replace('.', ',');
            subData[rowIndex].dev = dev > 0 ? `+${devFormatted}` : devFormatted;
          } else {
            subData[rowIndex].dev = '-';
          }
        }

        if (activeSubTable === 'LEAKAGE_AND_DIELECTRIC' && rowIndex === 0 && field === 'limit') {
           const limitOptions13 = ['≤0,75', '≤0,35 giá trị đỉnh', '≤0,7 giá trị đỉnh', '≤0,5', '≤3,5', 'FORMULA', '≤5'];
           const limitOptions16 = ['≤0,75', '≤0,25', '≤0,5', '≤0,5_2', '≤3,5', 'FORMULA', '≤5'];
           
           if (clauseId.startsWith('13')) {
              const selectedIdx = selectIndex !== undefined ? selectIndex : limitOptions13.indexOf(value);
              const otherId = clauseId.replace('13', '16');
              if (selectedIdx !== -1 && next[otherId]) {
                 const otherClause = { ...next[otherId] };
                 if (Array.isArray(otherClause.subData)) {
                    const otherSubData = [...otherClause.subData];
                    otherSubData[0] = { ...otherSubData[0], limit: limitOptions16[selectedIdx] };
                    otherClause.subData = otherSubData;
                    next[otherId] = otherClause;
                 }
              }
           } else if (clauseId.startsWith('16')) {
              const selectedIdx = selectIndex !== undefined ? selectIndex : limitOptions16.indexOf(value);
              const otherId = clauseId.replace('16', '13'); 
              if (selectedIdx !== -1 && next[otherId]) {
                 const otherClause = { ...next[otherId] };
                 if (Array.isArray(otherClause.subData)) {
                    const otherSubData = [...otherClause.subData];
                    otherSubData[0] = { ...otherSubData[0], limit: limitOptions13[selectedIdx] };
                    otherClause.subData = otherSubData;
                    next[otherId] = otherClause;
                 }
              }
           }
        }

      } else {
        if (field === 'ambient') subData.ambient = value;
        else if (field === 'inputTemp') subData.inputTemp = value;
        else if (field === 'condition') subData.condition = value;
        else if (field === 'workFollow') subData.workFollow = value;
        else if (field === 'rows') {
          const newRows = [...subData.rows];
          newRows[rowIndex] = { ...newRows[rowIndex], [subField!]: value };
          subData.rows = newRows;
        }
      }
      
      clause.subData = subData;
      next[clauseId] = clause;
      return next;
    });
  }

const handleAddRow = (clauseId: string) => {
    setTestResults(prev => {
      const next: any = { ...prev };
      const clause = { ...next[clauseId] };
      const activeSubTable = clause.subTable || selectedStandard?.clauses.find((c: any) => c.id === clauseId)?.subTable;

      if (activeSubTable === 'POWER_AND_CURRENT') {
        const subData = Array.isArray(clause.subData) ? [...clause.subData] : [];
        const prevCond = subData.length > 0 ? subData[subData.length - 1].cond : '';
        subData.push({ cond: prevCond, nominal: '', unit: 'W', result: '', limit: '-', dev: '-' });
        clause.subData = subData;
        next[clauseId] = clause;
      } else {
        const subData = { ...clause.subData };
        if (subData && Array.isArray(subData.rows)) {
          const newRows = [...subData.rows];
          newRows.push({ name: '', unit: '°C', result: '', limit: '' });
          subData.rows = newRows;
          clause.subData = subData;
          next[clauseId] = clause;
        }
      }
      return next;
    });
  }

const handleRemoveRow = (clauseId: string, rowIndex: number) => {
    setTestResults(prev => {
      const next: any = { ...prev };
      const clause = { ...next[clauseId] };
      const activeSubTable = clause.subTable || selectedStandard?.clauses.find((c: any) => c.id === clauseId)?.subTable;

      if (activeSubTable === 'POWER_AND_CURRENT') {
         if (Array.isArray(clause.subData)) {
            const subData = [...clause.subData];
            subData.splice(rowIndex, 1);
            clause.subData = subData;
            next[clauseId] = clause;
         }
      } else {
        const subData = { ...clause.subData };
        if (subData && Array.isArray(subData.rows)) {
          const newRows = [...subData.rows];
          newRows.splice(rowIndex, 1);
          subData.rows = newRows;
          clause.subData = subData;
          next[clauseId] = clause;
        }
      }
      return next;
    });
  }

const handleSectionFieldChange = (clauseId: string, sectionIndex: number, field: string, value: string) => {
    setTestResults(prev => {
      const entry = prev[clauseId];
      if (!entry || !entry.subData || !Array.isArray(entry.subData)) return prev;
      const newSubData = [...entry.subData];
      newSubData[sectionIndex] = { ...newSubData[sectionIndex], [field]: value };
      return { ...prev, [clauseId]: { ...entry, subData: newSubData } };
    });
  }

const renderSubTable = (clause: any) => {
    const data = testResults[clause.id]?.subData;
    if (!data) return null;

    if (clause.subTable === 'POWER_AND_CURRENT') {
      return (
        <div className="mt-2 mb-4 border border-slate-200 overflow-hidden bg-white">
          <div className={`px-2 py-1 text-xs font-bold flex justify-between items-center transition-colors ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <span className="uppercase tracking-tight">ĐIỀU {clause.id}: {clause.requirement}</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition" onClick={() => cycleEvaluation(clause.id)}>
              <div className={`w-3.5 h-3.5 rounded shadow-sm border ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-500 border-emerald-600' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'bg-red-500 border-red-600' : 'bg-slate-100 border-slate-300'}`}></div>
              <span className={`text-[10px] uppercase tracking-wide font-bold ${testResults[clause.id]?.evaluation === 'Đạt' ? 'text-emerald-300' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'text-red-500' : 'text-slate-500'}`}>
                {testResults[clause.id]?.evaluation === 'Đạt' ? 'Đạt' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'K.ĐẠT' : 'N/A'}
              </span>
            </div>
          </div>
          <table className="w-full text-xs border-collapse bg-white">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-left">Điều kiện đo</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-center">G.trị danh định</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-center w-12">Đơn vị</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-center">Kết quả đo</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-center">Mức quy định</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-center w-16">Sai lệch %</th>
                <th className="border-b border-slate-200 px-1.5 py-1 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: any, idx: number) => (
                <tr key={idx} className="group hover:bg-slate-50/50">
                  <td className="border-b border-r border-slate-200 px-1.5 py-1">
                     <textarea 
                        className="w-full bg-transparent outline-none resize-y overflow-hidden block text-xs" 
                        rows={Math.max(1, Math.ceil((row.cond || '').length / 30))} 
                        value={row.cond} 
                        onChange={e => {
                           e.target.style.height = 'auto';
                           e.target.style.height = `${e.target.scrollHeight}px`;
                           handleSubDataChange(clause.id, idx, 'cond', e.target.value);
                        }} 
                     />
                  </td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs font-medium" value={row.nominal} onChange={e => handleSubDataChange(clause.id, idx, 'nominal', e.target.value)} /></td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center">
                    <select className="w-full bg-transparent text-center outline-none text-[10px] font-mono" value={row.unit} onChange={e => handleSubDataChange(clause.id, idx, 'unit', e.target.value)}>
                      <option value="W">W</option>
                      <option value="A">A</option>
                    </select>
                  </td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 font-bold text-center"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.result} onChange={e => handleSubDataChange(clause.id, idx, 'result', e.target.value)} /></td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center">
                    <select className="w-full bg-transparent text-center outline-none text-xs font-medium" value={row.limit} onChange={e => handleSubDataChange(clause.id, idx, 'limit', e.target.value)}>
                      <option value="+5%; -10%">+5%; -10%</option>
                      <option value="+15%">+15%</option>
                      <option value="+20%">+20%</option>
                      <option value="±10%">±10%</option>
                      <option value="-">-</option>
                    </select>
                  </td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs font-mono" value={row.dev} onChange={e => handleSubDataChange(clause.id, idx, 'dev', e.target.value)} disabled /></td>
                  <td className="border-b border-slate-200 px-1.5 py-1 text-center">
                    <button 
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition text-[10px]"
                      onClick={() => handleRemoveRow(clause.id, idx)}
                      title="Xóa hàng này"
                    >
                      ✖
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={7} className="border-b border-slate-200 px-1.5 py-1.5 text-center bg-slate-50 hover:bg-slate-100 cursor-pointer text-slate-500 hover:text-emerald-600 transition text-xs font-medium" onClick={() => handleAddRow(clause.id)}>
                   + Thêm hàng mới
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (clause.subTable === 'HEATING' || clause.subTable?.startsWith('ABNORMAL')) {
      return (
        <div className="mt-2 mb-4 border border-slate-200 overflow-hidden bg-white">
          <div className={`px-2 py-1 text-xs font-bold flex justify-between items-center transition-colors ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <span className="uppercase tracking-tight">ĐIỀU {clause.id}: {clause.requirement}</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition" onClick={() => cycleEvaluation(clause.id)}>
              <div className={`w-3.5 h-3.5 rounded shadow-sm border ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-500 border-emerald-600' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'bg-red-500 border-red-600' : 'bg-slate-100 border-slate-300'}`}></div>
              <span className={`text-[10px] uppercase tracking-wide font-bold ${testResults[clause.id]?.evaluation === 'Đạt' ? 'text-emerald-300' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'text-red-500' : 'text-slate-500'}`}>
                {testResults[clause.id]?.evaluation === 'Đạt' ? 'Đạt' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'K.ĐẠT' : 'N/A'}
              </span>
            </div>
          </div>
          <div className="bg-slate-50 px-2 py-1 border-b border-slate-200 text-xs font-medium flex flex-col gap-1 text-slate-700">
             <div className="flex gap-4">
                <div className="flex items-center">Nhiệt độ môi trường: <input className="bg-transparent border-b border-slate-300 w-12 outline-none ml-1 text-center font-bold text-emerald-800 focus:border-emerald-500" value={data.ambient} onChange={e => handleSubDataChange(clause.id, 0, 'ambient', e.target.value)} /></div>
                {data.condition && <div className="flex items-center">Điều kiện làm việc: <input className="bg-transparent border-b border-slate-300 w-48 outline-none ml-1 font-bold text-emerald-800 focus:border-emerald-500" value={data.condition} onChange={e => handleSubDataChange(clause.id, 0, 'condition', e.target.value)} /></div>}
             </div>
             {clause.id !== '19' && (
               <div className="flex items-center">
                  <span className="shrink-0">Làm việc theo: </span>
                  <input className="bg-transparent border-b border-slate-300 flex-grow ml-1 outline-none font-bold text-emerald-800 focus:border-emerald-500" value={data.workFollow} onChange={e => handleSubDataChange(clause.id, 0, 'workFollow', e.target.value)} />
               </div>
             )}
          </div>
          <table className="w-full text-xs border-collapse bg-white">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-left">Thử nghiệm</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-12">Đơn vị</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-20">Kết quả</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-24">Mức quy định</th>
                <th className="border-b border-slate-200 px-1.5 py-1 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row: any, idx: number) => (
                <tr key={idx} className="group hover:bg-slate-50/50">
                  <td className="border-b border-r border-slate-200 px-1.5 py-1">
                    <textarea 
                      className="w-full bg-transparent outline-none resize-y overflow-hidden block text-xs" 
                      rows={Math.max(1, Math.ceil((row.name || '').length / 40))} 
                      value={row.name} 
                      onChange={e => {
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                        handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'name');
                      }} 
                    />
                  </td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs font-mono" value={row.unit} onChange={e => handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'unit')} /></td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center font-bold"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.result} onChange={e => handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'result')} /></td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.limit} onChange={e => handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'limit')} /></td>
                  <td className="border-b border-slate-200 px-1.5 py-1 text-center">
                    <button 
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition text-[10px]"
                      onClick={() => handleRemoveRow(clause.id, idx)}
                      title="Xóa hàng này"
                    >
                      ✖
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="border-b border-slate-200 px-1.5 py-1.5 text-center bg-slate-50 hover:bg-slate-100 cursor-pointer text-slate-500 hover:text-emerald-600 transition text-xs font-medium" onClick={() => handleAddRow(clause.id)}>
                   + Thêm hàng mới
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (clause.subTable === 'CLAUSE_32') {
      return (
        <div className="mt-2 mb-4 border border-slate-200 overflow-hidden bg-white">
          <div className={`px-2 py-1 text-xs font-bold flex justify-between items-center transition-colors ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <span className="uppercase tracking-tight">ĐIỀU {clause.id}: {clause.requirement}</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition" onClick={() => cycleEvaluation(clause.id)}>
              <div className={`w-3.5 h-3.5 rounded shadow-sm border ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-500 border-emerald-600' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'bg-red-500 border-red-600' : 'bg-slate-100 border-slate-300'}`}></div>
              <span className={`text-[10px] uppercase tracking-wide font-bold ${testResults[clause.id]?.evaluation === 'Đạt' ? 'text-emerald-300' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'text-red-500' : 'text-slate-500'}`}>
                {testResults[clause.id]?.evaluation === 'Đạt' ? 'Đạt' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'K.ĐẠT' : 'N/A'}
              </span>
            </div>
          </div>
          <div className="bg-slate-50 px-2 py-1 border-b border-slate-200 text-xs font-medium flex flex-col gap-1 text-slate-700">
             <div className="flex gap-4">
                <div className="flex items-center"><input className="bg-transparent border-b border-slate-300 w-80 outline-none font-bold text-emerald-800 focus:border-emerald-500" value={data.ambient} onChange={e => handleSubDataChange(clause.id, 0, 'ambient', e.target.value)} placeholder="Nhập ghi chú môi trường..." /></div>
             </div>
          </div>
          <table className="w-full text-xs border-collapse bg-white">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-left">Thử nghiệm</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-12">Đơn vị</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-20">Kết quả đo</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-24">Mức quy định</th>
                <th className="border-b border-slate-200 px-1.5 py-1 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row: any, idx: number) => (
                <tr key={idx} className="group hover:bg-slate-50/50">
                  <td className="border-b border-r border-slate-200 px-1.5 py-1">
                    <textarea 
                      className="w-full bg-transparent outline-none resize-y overflow-hidden block text-xs" 
                      rows={Math.max(1, Math.ceil((row.name || '').length / 40))} 
                      value={row.name} 
                      onChange={e => {
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                        handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'name');
                      }} 
                    />
                  </td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs font-mono" value={row.unit} onChange={e => handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'unit')} /></td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center font-bold"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.result} onChange={e => handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'result')} /></td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.limit} onChange={e => handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'limit')} /></td>
                  <td className="border-b border-slate-200 px-1.5 py-1 text-center">
                    <button 
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition text-[10px]"
                      onClick={() => handleRemoveRow(clause.id, idx)}
                      title="Xóa hàng này"
                    >
                      ✖
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="border-b border-slate-200 px-1.5 py-1.5 text-center bg-slate-50 hover:bg-slate-100 cursor-pointer text-slate-500 hover:text-emerald-600 transition text-xs font-medium" onClick={() => handleAddRow(clause.id)}>
                   + Thêm hàng mới
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (clause.subTable === 'CLAUSE_22' || clause.subTable === 'CLAUSE_24') {
      return (
        <div className="mt-2 mb-4 border border-slate-200 overflow-hidden bg-white">
          <div className={`px-2 py-1 text-xs font-bold flex justify-between items-center transition-colors ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <span className="uppercase tracking-tight">ĐIỀU {clause.id}: {clause.requirement}</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition" onClick={() => cycleEvaluation(clause.id)}>
              <div className={`w-3.5 h-3.5 rounded shadow-sm border ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-500 border-emerald-600' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'bg-red-500 border-red-600' : 'bg-slate-100 border-slate-300'}`}></div>
              <span className={`text-[10px] uppercase tracking-wide font-bold ${testResults[clause.id]?.evaluation === 'Đạt' ? 'text-emerald-300' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'text-red-500' : 'text-slate-500'}`}>
                {testResults[clause.id]?.evaluation === 'Đạt' ? 'Đạt' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'K.ĐẠT' : 'N/A'}
              </span>
            </div>
          </div>
          <div className="bg-slate-50 px-2 py-1 border-b border-slate-200 text-xs font-medium flex flex-col gap-1 text-slate-700">
             <div className="flex gap-4">
                {data.inputTemp !== undefined && (
                  <div className="flex items-center">Nhiệt độ nước đầu vào: <input className="bg-transparent border-b border-slate-300 w-12 outline-none ml-1 text-center font-bold text-emerald-800 focus:border-emerald-500" value={data.inputTemp} onChange={e => handleSubDataChange(clause.id, 0, 'inputTemp', e.target.value)} /> °C</div>
                )}
             </div>
          </div>
          <table className="w-full text-xs border-collapse bg-white">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-left">Thử nghiệm</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-12">Đơn vị</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-20">Kết quả</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-24">Mức quy định</th>
                <th className="border-b border-slate-200 px-1.5 py-1 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row: any, idx: number) => (
                <tr key={idx} className="group hover:bg-slate-50/50">
                  <td className="border-b border-r border-slate-200 px-1.5 py-1">
                    <textarea 
                      className="w-full bg-transparent outline-none resize-y overflow-hidden block text-xs" 
                      rows={Math.max(1, Math.ceil((row.name || '').length / 40))} 
                      value={row.name} 
                      onChange={e => {
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                        handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'name');
                      }} 
                    />
                  </td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs font-mono" value={row.unit} onChange={e => handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'unit')} /></td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center font-bold"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.result} onChange={e => handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'result')} /></td>
                  <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.limit} onChange={e => handleSubDataChange(clause.id, idx, 'rows', e.target.value, 'limit')} /></td>
                  <td className="border-b border-slate-200 px-1.5 py-1 text-center">
                    <button 
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition text-[10px]"
                      onClick={() => handleRemoveRow(clause.id, idx)}
                      title="Xóa hàng này"
                    >
                      ✖
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="border-b border-slate-200 px-1.5 py-1.5 text-center bg-slate-50 hover:bg-slate-100 cursor-pointer text-slate-500 hover:text-emerald-600 transition text-xs font-medium" onClick={() => handleAddRow(clause.id)}>
                   + Thêm hàng mới
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (clause.subTable === 'LEAKAGE_AND_DIELECTRIC' || clause.subTable === 'EARTHING') {
       return (
        <div className="mt-2 mb-4 border border-slate-200 overflow-hidden bg-white">
          <div className={`px-2 py-1 text-xs font-bold flex justify-between items-center transition-colors ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <span className="uppercase tracking-tight">ĐIỀU {clause.id}: {clause.requirement}</span>
            <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition" onClick={() => cycleEvaluation(clause.id)}>
              <div className={`w-3.5 h-3.5 rounded shadow-sm border ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-500 border-emerald-600' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'bg-red-500 border-red-600' : 'bg-slate-100 border-slate-300'}`}></div>
              <span className={`text-[10px] uppercase tracking-wide font-bold ${testResults[clause.id]?.evaluation === 'Đạt' ? 'text-emerald-300' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'text-red-500' : 'text-slate-500'}`}>
                {testResults[clause.id]?.evaluation === 'Đạt' ? 'Đạt' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'K.ĐẠT' : 'N/A'}
              </span>
            </div>
          </div>
          <table className="w-full text-xs border-collapse bg-white">
            <thead className="bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 text-left">Thử nghiệm</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-12">Đơn vị</th>
                <th className="border-b border-r border-slate-200 px-1.5 py-1 w-20">Kết quả</th>
                <th className="border-b border-slate-200 px-1.5 py-1 w-24">Mức quy định</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row: any, idx: number) => {
                 const isLeakageLimit = clause.subTable === 'LEAKAGE_AND_DIELECTRIC' && idx === 0;
                 return (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="border-b border-r border-slate-200 px-1.5 py-1 whitespace-pre-wrap">{row.name}</td>
                    <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs font-mono" value={row.unit} onChange={e => handleSubDataChange(clause.id, idx, 'unit', e.target.value)} /></td>
                    <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center font-bold"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.result} onChange={e => handleSubDataChange(clause.id, idx, 'result', e.target.value)} /></td>
                    <td className="border-b border-slate-200 px-1.5 py-1 text-center">
                      {isLeakageLimit ? (() => {
                        let powerW = 0;
                        const pData = testResults['10']?.subData;
                        if (pData && Array.isArray(pData)) powerW = parseFloat((pData[0].nominal || '').replace(',', '.')) || 0;
                        const computedVal = 0.75 * 0.001 * powerW;
                        const fStr = `≤${computedVal.toFixed(2).replace('.', ',')}`;
                        return (
                        <select className="w-full bg-transparent text-center outline-none text-[10px] font-medium" value={row.limit} onChange={e => handleSubDataChange(clause.id, idx, 'limit', e.target.value, undefined, undefined, e.target.selectedIndex)}>
                          {clause.id.startsWith('13') ? (
                             <>
                              <option value="≤0,75">≤0,75</option>
                              <option value="≤0,35 giá trị đỉnh">≤0,35 giá trị đỉnh</option>
                              <option value="≤0,7 giá trị đỉnh">≤0,7 giá trị đỉnh</option>
                              <option value="≤0,5">≤0,5</option>
                              <option value="≤3,5">≤3,5</option>
                              <option value="FORMULA">{fStr}</option>
                              <option value="≤5">≤5</option>
                              {!['≤0,75', '≤0,35 giá trị đỉnh', '≤0,7 giá trị đỉnh', '≤0,5', '≤3,5', 'FORMULA', '≤5'].includes(row.limit) && (
                                 <option value={row.limit}>{row.limit}</option>
                              )}
                             </>
                          ) : clause.id.startsWith('16') ? (
                             <>
                              <option value="≤0,75">≤0,75</option>
                              <option value="≤0,25">≤0,25</option>
                              <option value="≤0,5">≤0,5</option>
                              <option value="≤0,5_2">≤0,5</option>
                              <option value="≤3,5">≤3,5</option>
                              <option value="FORMULA">{fStr}</option>
                              <option value="≤5">≤5</option>
                              {!['≤0,75', '≤0,25', '≤0,5', '≤0,5_2', '≤3,5', 'FORMULA', '≤5'].includes(row.limit) && (
                                 <option value={row.limit}>{row.limit === '≤0,5_2' ? '≤0,5' : row.limit}</option>
                              )}
                             </>
                          ) : (
                             <option value={row.limit}>{row.limit}</option>
                          )}
                        </select>
                        );
                      })() : (
                        <input className="w-full bg-transparent text-center outline-none text-xs" value={row.limit} onChange={e => handleSubDataChange(clause.id, idx, 'limit', e.target.value)} />
                      )}
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (clause.subTable === 'CREEPAGE_CLEARANCE' || clause.subTable === 'HEAT_FIRE' || clause.subTable === 'CLAUSE_22_35') {
      return (
       <div className="mt-2 mb-4 border border-slate-200 overflow-hidden bg-white">
         <div className={`px-2 py-1 text-xs font-bold flex justify-between items-center transition-colors ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
           <span className="uppercase tracking-tight">ĐIỀU {clause.id}: {clause.requirement}</span>
           <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition" onClick={() => cycleEvaluation(clause.id)}>
             <div className={`w-3.5 h-3.5 rounded shadow-sm border ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-500 border-emerald-600' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'bg-red-500 border-red-600' : 'bg-slate-100 border-slate-300'}`}></div>
             <span className={`text-[10px] uppercase tracking-wide font-bold ${testResults[clause.id]?.evaluation === 'Đạt' ? 'text-emerald-300' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'text-red-500' : 'text-slate-500'}`}>
               {testResults[clause.id]?.evaluation === 'Đạt' ? 'Đạt' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'K.ĐẠT' : 'N/A'}
             </span>
           </div>
         </div>
         <table className="w-full text-xs border-collapse bg-white">
           <thead className="bg-slate-50 font-semibold text-slate-600">
             <tr>
               <th className="border-b border-r border-slate-200 px-1.5 py-1 text-left">{clause.subTable === 'CREEPAGE_CLEARANCE' ? 'Chiều dài đường rò / Khe hở' : 'Thử nghiệm'}</th>
               <th className="border-b border-r border-slate-200 px-1.5 py-1 w-12">Đơn vị</th>
               <th className="border-b border-r border-slate-200 px-1.5 py-1 w-20">Kết quả</th>
               <th className="border-b border-slate-200 px-1.5 py-1 w-24">Mức quy định</th>
             </tr>
           </thead>
           <tbody>
             {data.map((section: any, sIdx: number) => (
               <React.Fragment key={sIdx}>
                 <tr className="bg-slate-50 font-bold">
                   <td colSpan={4} className="border-b border-slate-200 px-2 py-1 text-center uppercase tracking-wide text-xs text-slate-700">{section.section}</td>
                 </tr>
                 {clause.subTable === 'CLAUSE_22_35' && (
                   <tr className="bg-emerald-50/50">
                     <td colSpan={4} className="border-b border-slate-200 px-2 py-1 text-xs text-slate-700">
                       {section.tempIn !== undefined && (
                         <span className="font-medium">Nhiệt độ nước đầu vào: <input className="bg-transparent border-b border-slate-300 w-12 outline-none text-center text-emerald-700 font-bold focus:border-emerald-500" value={section.tempIn} onChange={e => handleSectionFieldChange(clause.id, sIdx, 'tempIn', e.target.value)} /> °C </span>
                       )}
                       {section.tempOut !== undefined && (
                         <span className="ml-4 font-medium">Nhiệt độ nước đầu ra: <input className="bg-transparent border-b border-slate-300 w-12 outline-none text-center text-emerald-700 font-bold focus:border-emerald-500" value={section.tempOut} onChange={e => handleSectionFieldChange(clause.id, sIdx, 'tempOut', e.target.value)} /> °C</span>
                       )}
                     </td>
                   </tr>
                 )}
                 {section.rows.map((row: any, rIdx: number) => (
                   <tr key={rIdx} className="hover:bg-slate-50/50">
                     <td className="border-b border-r border-slate-200 px-2 py-1">{row.name}</td>
                     <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs font-mono" value={row.unit} onChange={e => handleSubDataChange(clause.id, rIdx, 'unit', e.target.value, undefined, sIdx)} /></td>
                     <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center font-bold"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.result} onChange={e => handleSubDataChange(clause.id, rIdx, 'result', e.target.value, undefined, sIdx)} /></td>
                     <td className="border-b border-slate-200 px-1.5 py-1 text-center"><input className="w-full bg-transparent text-center outline-none text-xs" value={row.limit} onChange={e => handleSubDataChange(clause.id, rIdx, 'limit', e.target.value, undefined, sIdx)} /></td>
                   </tr>
                 ))}
               </React.Fragment>
             ))}
           </tbody>
         </table>
       </div>
      );
    }

    return null;
  }

  return (
    <table className="w-full text-xs text-left border-collapse bg-white shadow-sm border-t border-b border-slate-200">
                    <thead className="bg-slate-50 sticky top-0 shadow-[0_1px_0_rgba(203,213,225,1)] z-10 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                      <tr>
                        <th className="px-1.5 py-2 border-b border-slate-200 w-8 text-center">Đ</th>
                        <th className="px-2 py-2 border-b border-slate-200">Yêu Cầu</th>
                        <th className="px-2 py-2 border-b border-slate-200">Kết Quả</th>
                        <th className="px-1.5 py-2 border-b border-slate-200 w-12 sm:w-16 text-center">Đ.Giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(criteriaType === 'reduced' && selectedStandard.reducedClauses ? selectedStandard.reducedClauses : selectedStandard.clauses).map((clause) => {
                         return (
                           <React.Fragment key={clause.id}>
                             <tr className={`border-b transition-colors ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'border-slate-100 hover:bg-slate-50'}`}>
                               <td className="px-1 py-2 align-top font-mono text-[10px] sm:text-xs text-slate-700 font-bold bg-transparent text-center">
                                 {clause.displayId !== undefined ? clause.displayId : clause.id}
                               </td>
                               <td className={`px-2 py-2 align-top leading-snug min-w-[100px] max-w-[200px] whitespace-pre-wrap bg-transparent text-xs ${clause.displayId === '' ? 'pl-3 sm:pl-4 text-slate-500' : (clause.id && !clause.id.includes('.') ? 'font-bold text-slate-800' : 'font-medium text-slate-700')}`}>
                                 {clause.requirement}
                               </td>
                               <td className="px-2 py-2 align-top min-w-[100px] bg-transparent">
                                 {!clause.subTable && (
                                   <textarea 
                                      className="w-full border-b border-slate-300 py-1 px-1 rounded-none text-xs bg-transparent focus:border-emerald-500 outline-none transition min-h-[36px] resize-y leading-tight"
                                      value={testResults[clause.id]?.result || ''}
                                      onChange={(e) => handleResultChange(clause.id, 'result', e.target.value)}
                                      placeholder="Ghi chú..."></textarea>
                                 )}
                               </td>
                               <td className="px-1.5 py-2 align-middle bg-transparent text-center">
                                 <div className="flex flex-col items-center justify-center h-full cursor-pointer hover:opacity-80 transition" onClick={() => cycleEvaluation(clause.id)}>
                                   <div className={`w-4 h-4 rounded shadow-sm border ${testResults[clause.id]?.evaluation === 'Đạt' ? 'bg-emerald-500 border-emerald-600' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'bg-red-500 border-red-600' : 'bg-slate-50 border-slate-300'}`} title={testResults[clause.id]?.evaluation === 'Đạt' ? 'Đạt' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'Không đạt' : 'N/A'}></div>
                                   <span className={`text-[9px] mt-1 font-bold ${testResults[clause.id]?.evaluation === 'Đạt' ? 'text-emerald-700' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'text-red-600' : 'text-slate-400'}`}>
                                     {testResults[clause.id]?.evaluation === 'Đạt' ? 'Đạt' : testResults[clause.id]?.evaluation === 'Không đạt' ? 'K.ĐẠT' : 'N/A'}
                                   </span>
                                 </div>
                               </td>
                             </tr>
                             </React.Fragment>
                         );
                      })}
                      {/* Appendix Section */}
                      <tr>
                         <td colSpan={4} className="bg-slate-50/50 px-2 sm:px-4 py-8 border-t-2 border-slate-300 border-double">
                            <div className="space-y-8">
                              <div className="text-center relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center">
                                  <h3 className="bg-slate-50 px-6 text-xs font-black uppercase tracking-[0.1em] text-slate-700 italic shadow-sm rounded-full py-1.5 border border-slate-200 text-center">
                                    KẾT QUẢ THỬ NGHIỆM CHI TIẾT
                                  </h3>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
                                {(criteriaType === 'reduced' && selectedStandard.reducedClauses ? selectedStandard.reducedClauses : selectedStandard.clauses).filter(c => c.subTable).map(clause => (
                                  <div key={`sub-${clause.id}`} className="transform hover:scale-[1.002] transition-all bg-white shadow-sm rounded-md border border-slate-200">
                                    {renderSubTable(clause)}
                                  </div>
                                ))}
                              </div>
                            </div>
                         </td>
                      </tr>
                    </tbody>
                  </table>
  );
}
// --- End of components/DefaultStandardForm.tsx ---
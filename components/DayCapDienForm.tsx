import React from 'react';

export interface DayCapDienData {
  items: Record<string, { limit: string; result: string }>;
  dropdown4_3: 'Điện trở cách điện' | 'Điện trở suất khối';
}

export const initialDayCapDienData: DayCapDienData = {
  items: {
    '1.1': { limit: 'Nhãn in trên cách điện, có thông tin và tên thương hiệu', result: '' },
    '1.2': { limit: 'Khoảng cách giữa 2 lần ghi nhãn ≤550', result: '' },
    '1.3': { limit: 'Nhãn rõ ràng và nhìn thấy được', result: '' },
    '1.4': { limit: 'Chuỗi nội dung có màu trắng, dễ phân biệt với màu của vỏ bọc', result: '' },
    '2.1': { limit: 'Màu:', result: '' },
    '3.1': { limit: 'Ruột dẫn cấp 5, Kích thước:', result: '' },
    '3.2': { limit: '≤26,0', result: '' },
    '4.1': { limit: 'Hợp chất cách điện PVC', result: '' },
    '4.2': { limit: '≥0,6', result: '' },
    '4.3': { limit: '- Điện áp thử: 500V\n- Thời gian thử: 01 phút\nNhiệt độ thử nghiệm:\n≥0,011', result: '' },
    '4.4': { limit: '- Điện áp thử: 2,0kV\n- Thời gian thử: 05 phút\nKhông bị đánh thủng', result: '' },
    '4.5_1': { limit: '≥10,0', result: '' },
    '4.5_2': { limit: '≥150', result: '' },
    '4.6_0': { limit: 'Điều kiện lão hóa: 80°C trong 168h', result: '' },
    '4.6_1': { limit: '≥10,0', result: '' },
    '4.6_2': { limit: '± 20', result: '' },
    '4.6_3': { limit: '≥150', result: '' },
    '4.6_4': { limit: '± 20', result: '' },
    '5.1': { limit: 'Vật liệu cách điện PVC/ST5', result: '' },
    '5.2': { limit: '≥0,8', result: '' },
    '5.3_1': { limit: '≥10,0', result: '' },
    '5.3_2': { limit: '≥150', result: '' },
    '5.4_0': { limit: 'Điều kiện lão hóa: 80°C trong 168h', result: '' },
    '5.4_1': { limit: '≥10,0', result: '' },
    '5.4_2': { limit: '± 20', result: '' },
    '5.4_3': { limit: '≥150', result: '' },
    '5.4_4': { limit: '± 20', result: '' },
  },
  dropdown4_3: 'Điện trở cách điện'
};

const InputCell = ({ id, field, isTextArea = false, data, handleChange }: { id: string, field: 'limit' | 'result', isTextArea?: boolean, data: DayCapDienData, handleChange: (id: string, field: 'limit' | 'result', value: string) => void }) => {
  const value = data.items[id]?.[field] || '';
  if (isTextArea) {
    return (
      <textarea 
        className="w-full bg-transparent border-b border-slate-300 py-1 outline-none focus:border-emerald-500 transition-colors min-h-[40px] text-[10px] leading-tight resize-y"
        value={value}
        onChange={e => handleChange(id, field, e.target.value)}
      />
    );
  }
  return (
    <input 
      className="w-full bg-transparent border-b border-slate-300 py-1 outline-none focus:border-emerald-500 transition-colors text-[10px] text-center font-bold"
      value={value}
      onChange={e => handleChange(id, field, e.target.value)}
    />
  );
};

export default function DayCapDienForm({
  data,
  setData,
  criteriaType
}: {
  data: DayCapDienData;
  setData: React.Dispatch<React.SetStateAction<DayCapDienData>>;
  criteriaType?: string;
}) {
  const handleChange = (id: string, field: 'limit' | 'result', value: string) => {
    setData(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [id]: {
          ...prev.items[id],
          [field]: value
        }
      }
    }));
  };

  const handleDropdown43Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setData(prev => ({
      ...prev,
      dropdown4_3: e.target.value as 'Điện trở cách điện' | 'Điện trở suất khối'
    }));
  };

  return (
    <div className="w-full mt-4 mb-4 border border-slate-200 bg-white overflow-hidden">
      <table className="w-full border-collapse text-xs bg-white">
        <thead className="bg-slate-50 font-bold uppercase text-center text-slate-600 tracking-wide text-[10px]">
          <tr>
            <th className="border-b border-r border-slate-200 p-2 w-8">TT</th>
            <th className="border-b border-r border-slate-200 p-2 w-[25%] text-left">Chỉ tiêu thử nghiệm</th>
            <th className="border-b border-r border-slate-200 p-2 w-16">Đơn vị</th>
            <th className="border-b border-r border-slate-200 p-2 w-[40%] text-left">Mức quy định</th>
            <th className="border-b border-slate-200 p-2 w-20">Kết quả</th>
          </tr>
        </thead>
        <tbody className="text-slate-800">
          {/* Header 1 */}
          <tr className="bg-slate-100/50 font-bold text-slate-700">
            <td className="border-b border-r border-slate-200 p-1.5 text-center">1</td>
            <td className="border-b border-slate-200 p-1.5" colSpan={4}>Ghi nhãn</td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">1.1</td>
            <td className="border-b border-r border-slate-200 p-1.5">Xuất xứ và dấu hiệu nhận biết</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-400">-</td>
            <td className="border-b border-r border-slate-200 p-1.5"><InputCell id="1.1" field="limit" isTextArea data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="1.1" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">1.2</td>
            <td className="border-b border-r border-slate-200 p-1.5">Độ liên tục của nhãn</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">mm</td>
            <td className="border-b border-r border-slate-200 p-1.5"><InputCell id="1.2" field="limit" isTextArea data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="1.2" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">1.3</td>
            <td className="border-b border-r border-slate-200 p-1.5">Độ bền của nhãn<br/><span className="text-slate-500 text-[10px]">- Lau 10 lần nhãn bằng vải thấm đẫm nước</span></td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-400">-</td>
            <td className="border-b border-r border-slate-200 p-1.5"><InputCell id="1.3" field="limit" isTextArea data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="1.3" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">1.4</td>
            <td className="border-b border-r border-slate-200 p-1.5">Độ rõ của nhãn</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-400">-</td>
            <td className="border-b border-r border-slate-200 p-1.5"><InputCell id="1.4" field="limit" isTextArea data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="1.4" field="result" data={data} handleChange={handleChange} /></td>
          </tr>

          {/* Header 2 */}
          <tr className="bg-slate-100/50 font-bold text-slate-700">
            <td className="border-b border-r border-slate-200 p-1.5 text-center">2</td>
            <td className="border-b border-slate-200 p-1.5" colSpan={4}>Nhận biết lõi</td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">2.1</td>
            <td className="border-b border-r border-slate-200 p-1.5">Nhận biết lõi bằng màu của cách điện</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-400">-</td>
            <td className="border-b border-r border-slate-200 p-1.5"><InputCell id="2.1" field="limit" isTextArea data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="2.1" field="result" data={data} handleChange={handleChange} /></td>
          </tr>

          {/* Header 3 */}
          <tr className="bg-slate-100/50 font-bold text-slate-700">
            <td className="border-b border-r border-slate-200 p-1.5 text-center">3</td>
            <td className="border-b border-slate-200 p-1.5" colSpan={4}>Ruột dẫn</td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">3.1</td>
            <td className="border-b border-r border-slate-200 p-1.5">Kích thước trung bình của cáp hoàn chỉnh</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">mm</td>
            <td className="border-b border-r border-slate-200 p-1.5"><InputCell id="3.1" field="limit" isTextArea data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="3.1" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">3.2</td>
            <td className="border-b border-r border-slate-200 p-1.5">Điện trở một chiều ruột dẫn ở 20°C</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">Ω/km</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="3.2" field="limit" data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="3.2" field="result" data={data} handleChange={handleChange} /></td>
          </tr>

          {/* Header 4 */}
          <tr className="bg-slate-100/50 font-bold text-slate-700">
            <td className="border-b border-r border-slate-200 p-1.5 text-center">4</td>
            <td className="border-b border-slate-200 p-1.5" colSpan={4}>Cách điện</td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">4.1</td>
            <td className="border-b border-r border-slate-200 p-1.5">Vật liệu cách điện</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-400">-</td>
            <td className="border-b border-r border-slate-200 p-1.5"><InputCell id="4.1" field="limit" isTextArea data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.1" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">4.2</td>
            <td className="border-b border-r border-slate-200 p-1.5">Chiều dày trung bình của cách điện</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">mm</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="4.2" field="limit" data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.2" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">4.3</td>
            <td className="border-b border-r border-slate-200 p-1.5">
              <select className="bg-emerald-50 text-emerald-900 border border-emerald-200 rounded outline-none p-1 font-bold w-full transition-colors hover:border-emerald-300 focus:ring-1 focus:ring-emerald-500" value={data.dropdown4_3} onChange={handleDropdown43Change}>
                <option value="Điện trở cách điện">Điện trở cách điện</option>
                <option value="Điện trở suất khối">Điện trở suất khối</option>
              </select>
            </td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center font-bold text-slate-600">
              {data.dropdown4_3 === 'Điện trở cách điện' ? 'MΩ.km' : 'Ω.cm'}
            </td>
            <td className="border-b border-r border-slate-200 p-1.5"><InputCell id="4.3" field="limit" isTextArea data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.3" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">4.4</td>
            <td className="border-b border-r border-slate-200 p-1.5">Độ bền điện áp tần số Công nghiệp</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-400">-</td>
            <td className="border-b border-r border-slate-200 p-1.5"><InputCell id="4.4" field="limit" isTextArea data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.4" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono" rowSpan={3}>4.5</td>
            <td className="border-b border-slate-200 p-1.5 font-bold" colSpan={4}>Thử nghiệm kéo cách điện trước lão hóa</td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-slate-600">- Độ bền kéo</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">N/mm²</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="4.5_1" field="limit" data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.5_1" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-slate-600">- Độ giãn dài tại thời điểm đứt</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">%</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="4.5_2" field="limit" data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.5_2" field="result" data={data} handleChange={handleChange} /></td>
          </tr>

          {criteriaType !== 'reduced' && (
            <>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono" rowSpan={7}>4.6</td>
                <td className="border-b border-r border-slate-200 p-1.5 font-bold text-slate-700">Thử nghiệm kéo cách điện sau lão hóa</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="4.6_0" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 font-medium text-slate-600">- Độ bền kéo</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-slate-200 p-1.5 text-center"></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-slate-600 pl-4">+ Giá trị sau lão hóa</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">N/mm²</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="4.6_1" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.6_1" field="result" data={data} handleChange={handleChange} /></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-slate-600 pl-4">+ Sự thay đổi</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">%</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="4.6_2" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.6_2" field="result" data={data} handleChange={handleChange} /></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 font-medium text-slate-600">- Độ giãn dài tại thời điểm đứt</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-slate-200 p-1.5 text-center"></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-slate-600 pl-4">+ Giá trị sau lão hóa</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">%</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="4.6_3" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.6_3" field="result" data={data} handleChange={handleChange} /></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-slate-600 pl-4">+ Sự thay đổi</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">%</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="4.6_4" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="4.6_4" field="result" data={data} handleChange={handleChange} /></td>
              </tr>
            </>
          )}

          {/* Header 5 */}
          <tr className="bg-slate-100/50 font-bold text-slate-700">
            <td className="border-b border-r border-slate-200 p-1.5 text-center">5</td>
            <td className="border-b border-slate-200 p-1.5" colSpan={4}>Vỏ bọc</td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">5.1</td>
            <td className="border-b border-r border-slate-200 p-1.5">Vật liệu vỏ bọc</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="5.1" field="limit" data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="5.1" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono">5.2</td>
            <td className="border-b border-r border-slate-200 p-1.5">Chiều dày trung bình của vỏ bọc</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">mm</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="5.2" field="limit" data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="5.2" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono" rowSpan={3}>5.3</td>
            <td className="border-b border-slate-200 p-1.5 font-bold text-slate-700" colSpan={4}>Thử nghiệm kéo vỏ bọc trước lão hóa</td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-slate-600">- Độ bền kéo</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">N/mm²</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="5.3_1" field="limit" data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="5.3_1" field="result" data={data} handleChange={handleChange} /></td>
          </tr>
          <tr className="hover:bg-slate-50/50 transition-colors">
            <td className="border-b border-r border-slate-200 p-1.5 text-slate-600">- Độ giãn dài tại thời điểm đứt</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">%</td>
            <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="5.3_2" field="limit" data={data} handleChange={handleChange} /></td>
            <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="5.3_2" field="result" data={data} handleChange={handleChange} /></td>
          </tr>

          {criteriaType !== 'reduced' && (
            <>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500 font-mono" rowSpan={7}>5.4</td>
                <td className="border-b border-r border-slate-200 p-1.5 font-bold text-slate-700">Thử nghiệm kéo vỏ bọc sau lão hóa</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="5.4_0" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 font-medium text-slate-600">- Độ bền kéo</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-slate-200 p-1.5 text-center"></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-slate-600 pl-4">+ Giá trị sau lão hóa</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">N/mm²</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="5.4_1" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="5.4_1" field="result" data={data} handleChange={handleChange} /></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-slate-600 pl-4">+ Sự thay đổi</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">%</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="5.4_2" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="5.4_2" field="result" data={data} handleChange={handleChange} /></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 font-medium text-slate-600">- Độ giãn dài tại thời điểm đứt</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"></td>
                <td className="border-b border-slate-200 p-1.5 text-center"></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-slate-600 pl-4">+ Giá trị sau lão hóa</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">%</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="5.4_3" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="5.4_3" field="result" data={data} handleChange={handleChange} /></td>
              </tr>
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="border-b border-r border-slate-200 p-1.5 text-slate-600 pl-4">+ Sự thay đổi</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center text-slate-500">%</td>
                <td className="border-b border-r border-slate-200 p-1.5 text-center"><InputCell id="5.4_4" field="limit" data={data} handleChange={handleChange} /></td>
                <td className="border-b border-slate-200 p-1.5 text-center"><InputCell id="5.4_4" field="result" data={data} handleChange={handleChange} /></td>
              </tr>
            </>
          )}

        </tbody>
      </table>
    </div>
  );
}

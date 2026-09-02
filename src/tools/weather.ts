/**
 * Weather Tool - 天气查询工具
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * 天气查询结果类型
 */
export interface WeatherResult {
  destination: string;
  condition: string;
  temperature: string;
  advice: string;
}

/**
 * 天气查询工具（LangChain tool）
 */
export const queryWeatherTool = tool(
  async ({ destination }: { destination: string }): Promise<WeatherResult> => {
    console.log(`[工具调用] 查询 ${destination} 的天气...`);

    // 模拟不同城市的天气数据
    const weatherData: Record<string, WeatherResult> = {
      上海: {
        destination: "上海",
        condition: "小雨",
        temperature: "12-18°C",
        advice: "准备折叠伞和轻便雨衣",
      },
      北京: {
        destination: "北京",
        condition: "晴",
        temperature: "5-15°C",
        advice: "早晚温差大，建议携带外套",
      },
      深圳: {
        destination: "深圳",
        condition: "多云",
        temperature: "18-25°C",
        advice: "天气宜人，注意防晒",
      },
      杭州: {
        destination: "杭州",
        condition: "阴",
        temperature: "10-16°C",
        advice: "可能有雨，建议携带雨具",
      },
    };

    // 模拟 API 延迟
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result =
      weatherData[destination] || {
        destination,
        condition: "未知",
        temperature: "未知",
        advice: "请关注当地天气预报",
      };

    console.log(`[工具结果] ${destination}: ${result.condition}, ${result.temperature}`);

    return result;
  },
  {
    name: "query_weather",
    description: "查询指定城市的天气信息，返回天气状况、温度和建议",
    schema: z.object({
      destination: z.string().describe("目的地城市名称"),
    }),
  }
);

/**
 * 普通函数版本的天气查询
 * 用于在节点中直接调用
 */
export async function queryWeather(destination: string): Promise<WeatherResult> {
  return queryWeatherTool.invoke({ destination });
}

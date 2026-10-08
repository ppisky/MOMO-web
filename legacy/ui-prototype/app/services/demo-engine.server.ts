import type { ConversationEngine } from "../../shared/contracts/chat";

function replyTo(text: string): string {
  if (/代码|编程|函数|TypeScript/i.test(text))
    return "可以，我们先把问题拆小一点。\n\n### 一个清晰的起点\n\n先确定函数的输入、输出和边界条件，再写最小实现。例如，一个类型安全的分组函数：\n\n```ts\nfunction groupBy<T>(items: T[], key: (item: T) => string) {\n  return items.reduce<Record<string, T[]>>((groups, item) => {\n    (groups[key(item)] ??= []).push(item);\n    return groups;\n  }, {});\n}\n```\n\n接下来可以补上空数组、重复键和异常输入的测试。\n\n你可以继续输入，体验多轮对话的界面。\n\n*这是一段预设演示回复，尚未连接真实模型。*";
  if (/计划|周|安排/.test(text))
    return "当然。比起把时间填满，我们可以先给真正重要的事情留出空间。\n\n### 一份轻量的本周计划\n\n1. **选出一件最重要的事**：写下这周结束时，你最希望完成的结果。\n2. **留出两段专注时间**：把需要思考的工作安排在精力最好的时候。\n3. **把杂事集中处理**：消息、整理和零散任务，放进固定的小时间块。\n4. **留一点空白**：预留缓冲，让计划能跟着实际情况调整。\n\n> 计划的意义，是让你知道下一步做什么，而不是让每一分钟都被占满。\n\n*这是一段预设演示回复，尚未连接真实模型。*";
  if (/写|文案|灵感/.test(text))
    return "我们可以从一个具体的画面开始，让表达自然一点。\n\n### 换个角度打开灵感\n\n- **从日常切入**：记录一个你今天留意到的小细节。\n- **先说人话**：想象你在向一个熟悉的人讲述，而不是写一篇正式文章。\n- **留下一个记忆点**：一段文字，只围绕一个值得记住的想法展开。\n\n比如这样的开头：\n\n> 午后的光落在桌角，没写完的句子旁边，是一杯刚刚好的咖啡。有些想法，不急着找到答案。\n\n你想把它写成一段短文，还是一封信？\n\n*这是一段预设演示回复，尚未连接真实模型。*";
  return "收到，我们一起理一理。\n\n你可以在这里把还没成形的想法写下来，不必一开始就组织得很完整。\n\n### 试着从三个问题开始\n\n1. **你想达成什么？** 用一句话描述理想的结果。\n2. **现在卡在哪里？** 把已经知道的和还不确定的分开。\n3. **下一步能做什么？** 找一个足够小、现在就能开始的行动。\n\n我会在这里，陪你把问题逐步说清楚。\n\n*当前为界面演示：这是预设回复，没有发送给真实 AI 服务。*";
}

export const demoEngine: ConversationEngine = {
  id: "demo",
  async *stream(request, signal) {
    const text = replyTo(
      request.messages.filter((m) => m.role === "user").at(-1)?.text ?? "",
    );
    for (let index = 0; index < text.length; index += 5) {
      if (signal.aborted) return;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, 24);
        function done() {
          clearTimeout(timer);
          signal.removeEventListener("abort", done);
          resolve();
        }
        signal.addEventListener("abort", done, { once: true });
      });
      if (signal.aborted) return;
      yield { type: "text-delta", text: text.slice(index, index + 5) };
    }
    yield { type: "finish" };
  },
};

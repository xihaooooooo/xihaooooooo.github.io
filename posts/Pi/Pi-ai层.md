这一层是比较底层的，关注于与模型的交互。

它有很多的适配器来对不同的模型厂商进行适配，不同的厂商可能使用同一个适配器，也可能使用不同的。这是因为模型接受的消息不一样，比如Anthropic它把工具返回的消息放进了User消息里面，而openai则不一样。Pi它定义了一个toolResult，当要真正发送的时候使用适配器对其进行转换。

toolResult是存在messages里面，而messages是存在context里面的。
```
interface Context {
  systemPrompt?: string;
  messages: Message[];
  tools?: Tool[];
}
```
systemPrompt和messages大家应该都了解吧。那tools是什么呢？很简单，模型要让agent调用工具，可它是怎么知道有这些工具的呢，就是靠tools。tools里面的Tool描述了这个工具的作用与可以干什么
```
interface Tool {
  name: string;         // 名字，模型用它来"申请"
  description: string;  // 说明书，模型靠它决定要不要用
  parameters: TSchema;  // 参数格式表（typebox）
}
```
每次请求，Pi都会把context发给模型，因为messages是有变化的，所以每次都是当成拼好发给模型

模型接受到消息，就要返回消息，
这个算法的大体意思是，α和β是形状参数，根据它们在Beta曲线上面抽样本，不同的值抽的样本侧重不同，α=3.997、β=1.003 抽出来的 θ 大概率在 0.8 附近晃；α=1.03、β=3.997 抽出来的 θ 大概率在 0.2 附近晃。
对于alpha和beta，它是基于BKT算出来的p(l)掌握度来进行计算的，不过它也有很多因素影响。
对于每一个小节
```
potential = 1 - P(L)          ← 提升空间
α = 1 + k × potential
β = 1 + k × P(L)
```
k是先验强度，

如果练习后它的p(l)是有提示的这时候就认为它的练习是有效的所以加强练习
```
reward = session_rewards.get(key, session_rewards.get(sid, 0.0))
if reward > 0:
    reward_boost = min(reward, 1.0) * potential * 2.0
    α += reward_boost
```
如果p(l)本身就很高提示很小，本身很低提示很大

如果
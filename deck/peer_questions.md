# Peer Questions for Other Groups [GENAI]

Two questions per group for the peer Q&A (participation is assessed). Topics from the course brief: Group 1 AI for Inventory Management, Group 2 AI in Logistics and Route Optimization, Group 4 AI in Demand Forecasting. Each question links to something we learned building PharmaShield, so we can follow up if asked.

## Group 1 - AI for Inventory Management

1. When your model sets safety stock for a critical item, how does it change if the main supplier's delivery risk suddenly rises? Do you feed supplier-level risk into the reorder point, or only demand variability?
2. How do you stop the model from recommending a low stock level for an item whose lack of history comes from data gaps rather than low demand? In our work, missing evidence looked like good evidence until we added a neutral-evidence rule.

## Group 2 - AI in Logistics and Route Optimization

1. Your route optimiser presumably minimises cost or time. How do you represent a chokepoint that might close, such as Hormuz or a closed airspace: as a hard constraint, a probability, or a cost penalty? And who sets that penalty?
2. When you validate the model, do you test on a later period than you train on? We found the late-delivery rate rose from 10.7% to 14.0% between our training and test years, so a random split would have flattered our model.

## Group 4 - AI in Demand Forecasting

1. How do you separate real demand from demand that was suppressed by stock-outs? During a shortage, recorded sales fall even though patients still need the drug.
2. Which business metric decides which forecast model you keep: a statistical score such as MAPE, or the cost of the decisions it drives, such as stock-outs avoided? We found ROC-AUC alone hid a large difference in false alarms.

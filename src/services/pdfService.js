
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

const pdfService = {
    /**
     * Generates HTML for the order receipt
     * @param {Object} order 
     * @returns {String} HTML string
     */
    generateOrderHTML: (order) => {
        // Format date
        const date = new Date(order.timestamp).toLocaleString();

        // Calculate totals
        const totalAmount = order.total.toFixed(2);

        // Items rows
        const itemsRows = order.items.map(item => `
      <tr>
        <td style="text-align: left; padding: 5px; border-bottom: 1px solid #eee;">
          <div style="font-weight: bold;">${item.name}</div>
          <div style="font-size: 10px; color: #666;">${item.code || ''}</div>
        </td>
        <td style="text-align: center; padding: 5px; border-bottom: 1px solid #eee;">${item.qty}</td>
        <td style="text-align: right; padding: 5px; border-bottom: 1px solid #eee;">${item.price.toFixed(2)}</td>
        <td style="text-align: right; padding: 5px; border-bottom: 1px solid #eee;">${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

        return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; color: #2c3e50; }
            .subtitle { font-size: 14px; color: #7f8c8d; margin-bottom: 20px; }
            
            .info-card { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e9ecef; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .label { font-weight: 600; color: #7f8c8d; }
            .value { font-weight: bold; color: #2c3e50; }

            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; padding: 8px 5px; background-color: #f8f9fa; color: #2c3e50; font-size: 12px; border-bottom: 2px solid #dde1e5; }
            td { font-size: 13px; }
            
            .totals { margin-top: 20px; border-top: 2px solid #2c3e50; padding-top: 10px; }
            .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; color: #2c3e50; }
            
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #95a5a6; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">TaskSAS</div>
            <div class="subtitle">Order Receipt</div>
          </div>

          <div class="info-card">
            <div class="info-row">
              <span class="label">Date:</span>
              <span class="value">${date}</span>
            </div>
            <div class="info-row">
              <span class="label">Customer:</span>
              <span class="value">${order.customer}</span>
            </div>
            <div class="info-row">
              <span class="label">Area:</span>
              <span class="value">${order.area}</span>
            </div>
            ${order.orderCode ? `
            <div class="info-row">
              <span class="label">Order Code:</span>
              <span class="value">${order.orderCode}</span>
            </div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40%">Item</th>
                <th style="width: 15%; text-align: center;">Qty</th>
                <th style="width: 20%; text-align: right;">Price</th>
                <th style="width: 25%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Total Amount</span>
              <span>${totalAmount}</span>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Generated via TaskSAS App</p>
          </div>
        </body>
      </html>
    `;
    },

    /**
     * Generates PDF and opens system share sheet
     * @param {Object} order 
     */
    shareOrderPDF: async (order) => {
        try {
            const html = pdfService.generateOrderHTML(order);

            const { uri } = await Print.printToFileAsync({
                html: html,
                base64: false
            });

            await Sharing.shareAsync(uri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
                dialogTitle: `Share Order - ${order.customer}`
            });

            return true;
        } catch (error) {
            console.error('Error generating PDF:', error);
            Alert.alert('Error', 'Failed to generate or share PDF');
            return false;
        }
    }
};

export default pdfService;

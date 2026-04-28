// 设备数据配置文件

export interface Device {
	name: string;
	image: string;
	specs: string;
	description: string;
	link: string;
}

// 设备类别类型，支持品牌和自定义类别
export type DeviceCategory = {
	[categoryName: string]: Device[];
} & {
	自定义?: Device[];
};

export const devicesData: DeviceCategory = {
	iPad: [
		{
			name: "iPad 10代 (2022年)",
			image: "/images/device/iPad10.png",
			specs: "藍色 / 4G + 256GB",
			description: "可愛，可畫，可圈可點.",
			link: "https://www.apple.com/tw/ipad/",
		},
	],
	MacBook_Pro: [
		{
			name: "MacBook Pro (Retina, 13 英吋 , 2014 年中)",
			image: "/images/device/MacbookPro2014.png",
			specs: "i5 2.6GHz / 8G + 512GB",
			description:
				"二手買的 應該是改過接口 讓NVME 512GB能用 目前比較可惜是螢幕部分顯示異常.",
			link: "https://support.apple.com/zh-tw/111942",
		},
	],
	Redmi: [
		{
			name: "Redmi 12C",
			image: "/images/device/Redmi-12C.webp",
			specs: "MediaTek Helio G85 8 Core 2.0GHz / 4G + 64GB",
			description: "手機 平時用來看直播間情況用.",
			link: "https://www.mi.com/tw/product/redmi-12c/",
		},
	],
	PC: [
		{
			name: "Windows 11 桌機",
			image: "/images/device/B450M.webp",
			specs: "AMD Ryzen R5 5500GT 3.6GHz / 64G + 500GB",
			description: "主要桌機 用於處理回放加工 或其他服務器搭建.",
			link: "https://www.gigabyte.com/tw/Motherboard/B450M-GAMING-rev-1x",
		},
	],
};

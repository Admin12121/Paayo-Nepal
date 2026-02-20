export const blogDetailData = {
  'langtang-trek': {
    slug: 'langtang-trek',
    title: 'Unforgottable Experience Of Langtang Trek',
    date: 'JULY 15, 2025',
    author: 'JOHN CENA',
    featuredImage: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&h=500&fit=crop',
    caption: 'Porters transporting expedition supplies and goods along the rocky trails of the Langtang Valley trek.',
    content: [
      {
        type: 'text',
        value: 'Lorem ipsum dolor sit amet consectetur. Elit donec faucibus phasellus viverra. Phasellus etiam ullamcorper etiam auctor ornare nullam pretium integer porta. Quis nisi aenean viverra porttitor eu lobortis risus a. Ac nascetur maecenas morbi tortor amet amet mauris. Mollis massa sit nullam sem. Id malesuada maecenas consectetur enim suspendisse iaculis erat iaculis.'
      },
      {
        type: 'image',
        value: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&h=400&fit=crop'
      },
      {
        type: 'image',
        value: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop'
      },
      {
        type: 'image',
        value: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=500&fit=crop'
      }
    ],
    stats: {
      views: 12,
      likes: 129,
      comments: 886
    },
    comments: [
      {
        id: 1,
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=50&h=50&fit=crop',
        name: 'Courtney Henry',
        text: 'Ultricies ultricies interdum dolor sodales. Vitae feugiat vitae vitae quis id consectetur. Aenean urna, luctus amet suscipit eget. Tristique bibendum nibh enim dui.',
        time: '20h',
        replies: [
          {
            id: 11,
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop',
            name: 'Ronald Richards',
            text: 'Lorem fringilla pretium magna purus orci faucibus morbi.',
            time: '8h'
          }
        ]
      },
      {
        id: 2,
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop',
        name: 'Theresa Webb',
        text: 'Donec sed sed feugiat sit. Enim, urna euismod magna enim. Sit cras eget id sagittis consequat ut.',
        time: '23h',
        replies: []
      }
    ],
    totalComments: 13
  }
};

export const moreDestinations = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1585409677983-0f6c41ca9c3b?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 13,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 12,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 12,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 17,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  },
  {
    id: 5,
    image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 13,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  },
  {
    id: 6,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 13,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  },
  {
    id: 7,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 12,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  },
  {
    id: 8,
    image: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 13,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  },
  {
    id: 9,
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 13,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  },
  {
    id: 10,
    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&h=180&fit=crop',
    date: 'APRIL 18, 2025',
    views: 13,
    title: 'TOP TEN BEST RELIGIOUS PLACES TO TRAVEL'
  }
];

export type BlogDetail = typeof blogDetailData['langtang-trek'];
export type Comment = typeof blogDetailData['langtang-trek']['comments'][0];
export type Destination = typeof moreDestinations[0];

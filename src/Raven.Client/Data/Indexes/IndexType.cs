﻿namespace Raven.Client.Data.Indexes
{
    public enum IndexType
    {
        Unknown,
        AutoMap,
        AutoMapReduce,
        Map,
        MapReduce
    }

    public static class IndexTypeExtensions
    {
        public static bool IsMap(this IndexType self)
        {
            return self == IndexType.Map || self == IndexType.AutoMap;
        }

        public static bool IsMapReduce(this IndexType self)
        {
            return self == IndexType.MapReduce || self == IndexType.AutoMapReduce;
        }
    }
}
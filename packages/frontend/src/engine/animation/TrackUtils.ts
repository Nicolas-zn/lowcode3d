import * as THREE from 'three'

/**
 * TrackUtils - 关键帧轨道工具类
 *
 * 提供关键帧的增删改查、排序、去重等功能
 */
export class TrackUtils {
  /**
   * 添加或更新关键帧
   * 如果指定时间点已存在关键帧，则更新；否则插入新关键帧
   */
  static addOrUpdateKeyframe(
    track: THREE.KeyframeTrack,
    time: number,
    value: THREE.Vector3 | THREE.Vector2 | THREE.Quaternion | THREE.Color | number | number[]
  ): THREE.KeyframeTrack {
    const times = Array.from(track.times)
    const values = Array.from(track.values)
    const valueSize = track.getValueSize()

    // 查找插入位置
    const index = this.findTimeIndex(times, time)

    // 将值转换为 flat array
    const flatValue = this.valueToArray(value, valueSize)

    if (index < times.length && Math.abs(times[index] - time) < 0.001) {
      // 更新现有关键帧
      for (let i = 0; i < valueSize; i++) {
        values[index * valueSize + i] = flatValue[i]
      }
    } else {
      // 插入新关键帧
      times.splice(index, 0, time)
      values.splice(index * valueSize, 0, ...flatValue)
    }

    // 创建新的 track
    return this.createTrackFromArrays(
      track.name,
      times,
      values,
      track.ValueTypeName as string,
      track.getInterpolation()
    )
  }

  /**
   * 删除关键帧
   */
  static removeKeyframe(
    track: THREE.KeyframeTrack,
    time: number,
    tolerance: number = 0.001
  ): THREE.KeyframeTrack {
    const times = Array.from(track.times)
    const values = Array.from(track.values)
    const valueSize = track.getValueSize()

    // 查找要删除的关键帧
    const index = times.findIndex((t) => Math.abs(t - time) < tolerance)

    if (index !== -1) {
      times.splice(index, 1)
      values.splice(index * valueSize, valueSize)
    }

    return this.createTrackFromArrays(
      track.name,
      times,
      values,
      track.ValueTypeName as string,
      track.getInterpolation()
    )
  }

  /**
   * 提取所有关键帧为易读格式
   */
  static extractKeyframes(track: THREE.KeyframeTrack): Array<{
    time: number
    value: THREE.Vector3 | THREE.Vector2 | THREE.Quaternion | THREE.Color | number | number[]
  }> {
    const keyframes: Array<{
      time: number
      value: THREE.Vector3 | THREE.Vector2 | THREE.Quaternion | THREE.Color | number | number[]
    }> = []
    const times = track.times
    const values = track.values
    const valueSize = track.getValueSize()

    for (let i = 0; i < times.length; i++) {
      const time = times[i]
      const valueArray = values.slice(i * valueSize, (i + 1) * valueSize)
      const value = this.arrayToValue(valueArray, track.ValueTypeName)

      keyframes.push({ time, value })
    }

    return keyframes
  }

  /**
   * 查找时间点应该插入的位置（二分查找）
   */
  static findTimeIndex(times: number[], time: number): number {
    let left = 0
    let right = times.length

    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (times[mid] < time) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    return left
  }

  /**
   * 将值转换为数组
   */
  static valueToArray(
    value: THREE.Vector3 | THREE.Vector2 | THREE.Quaternion | THREE.Color | number | number[],
    expectedSize: number
  ): number[] {
    if (Array.isArray(value)) {
      return value.slice(0, expectedSize)
    }

    if (value instanceof THREE.Vector3) {
      return [value.x, value.y, value.z]
    }

    if (value instanceof THREE.Vector2) {
      return [value.x, value.y]
    }

    if (value instanceof THREE.Quaternion) {
      return [value.x, value.y, value.z, value.w]
    }

    if (value instanceof THREE.Color) {
      return [value.r, value.g, value.b]
    }

    if (typeof value === 'number') {
      return [value]
    }

    // 默认填充
    return new Array(expectedSize).fill(0)
  }

  /**
   * 将数组转换为对应的值类型
   */
  static arrayToValue(
    array: ArrayLike<number>,
    typeName: string
  ): THREE.Vector3 | THREE.Vector2 | THREE.Quaternion | THREE.Color | number | number[] {
    switch (typeName) {
      case 'vector':
        if (array.length === 3) {
          return new THREE.Vector3(array[0], array[1], array[2])
        } else if (array.length === 2) {
          return new THREE.Vector2(array[0], array[1])
        }
        break

      case 'quaternion':
        return new THREE.Quaternion(array[0], array[1], array[2], array[3])

      case 'color':
        return new THREE.Color(array[0], array[1], array[2])

      case 'number':
        return array[0]

      default:
        return Array.from(array)
    }

    return Array.from(array)
  }

  /**
   * 将多个值扁平化为数组（用于创建 track）
   */
  static flattenValues(
    values: (THREE.Vector3 | THREE.Vector2 | THREE.Quaternion | THREE.Color | number | number[])[],
    _propertyName: string
  ): number[] {
    const result: number[] = []

    for (const value of values) {
      if (value instanceof THREE.Vector3) {
        result.push(value.x, value.y, value.z)
      } else if (value instanceof THREE.Vector2) {
        result.push(value.x, value.y)
      } else if (value instanceof THREE.Quaternion) {
        result.push(value.x, value.y, value.z, value.w)
      } else if (value instanceof THREE.Color) {
        result.push(value.r, value.g, value.b)
      } else if (typeof value === 'number') {
        result.push(value)
      } else if (Array.isArray(value)) {
        result.push(...value)
      } else {
        result.push(0)
      }
    }

    return result
  }

  /**
   * 创建 KeyframeTrack（根据类型名）
   */
  static createTrackFromArrays(
    name: string,
    times: number[],
    values: number[],
    typeName: string,
    interpolation: THREE.InterpolationModes
  ): THREE.KeyframeTrack {
    switch (typeName) {
      case 'vector':
        return new THREE.VectorKeyframeTrack(name, times, values, interpolation)

      case 'quaternion':
        return new THREE.QuaternionKeyframeTrack(name, times, values, interpolation)

      case 'color':
        return new THREE.ColorKeyframeTrack(name, times, values, interpolation)

      case 'number':
        return new THREE.NumberKeyframeTrack(name, times, values, interpolation)

      case 'bool':
      case 'boolean':
        return new THREE.BooleanKeyframeTrack(
          name,
          times,
          values.map((v) => v > 0.5)
        )

      case 'string':
        return new THREE.StringKeyframeTrack(
          name,
          times,
          values as unknown as string[],
          interpolation
        )

      default:
        return new THREE.NumberKeyframeTrack(name, times, values, interpolation)
    }
  }

  /**
   * 去除重复的关键帧（时间相同）
   */
  static removeDuplicates(
    track: THREE.KeyframeTrack,
    tolerance: number = 0.001
  ): THREE.KeyframeTrack {
    const times = Array.from(track.times)
    const values = Array.from(track.values)
    const valueSize = track.getValueSize()

    const uniqueTimes: number[] = []
    const uniqueValues: number[] = []

    for (let i = 0; i < times.length; i++) {
      const time = times[i]

      if (i === 0 || Math.abs(time - uniqueTimes[uniqueTimes.length - 1]) > tolerance) {
        uniqueTimes.push(time)
        uniqueValues.push(...values.slice(i * valueSize, (i + 1) * valueSize))
      }
    }

    return this.createTrackFromArrays(
      track.name,
      uniqueTimes,
      uniqueValues,
      track.ValueTypeName as string,
      track.getInterpolation()
    )
  }

  /**
   * 优化轨道：移除冗余的关键帧
   */
  static optimize(track: THREE.KeyframeTrack, tolerance: number = 0.0001): THREE.KeyframeTrack {
    const times = Array.from(track.times)
    const values = Array.from(track.values)
    const valueSize = track.getValueSize()

    if (times.length <= 2) {
      return track
    }

    const optimizedTimes: number[] = [times[0]]
    const optimizedValues: number[] = values.slice(0, valueSize)

    for (let i = 1; i < times.length - 1; i++) {
      const t0 = times[i - 1]
      const t1 = times[i]
      const t2 = times[i + 1]

      const v0 = values.slice((i - 1) * valueSize, i * valueSize)
      const v1 = values.slice(i * valueSize, (i + 1) * valueSize)
      const v2 = values.slice((i + 1) * valueSize, (i + 2) * valueSize)

      const alpha = (t1 - t0) / (t2 - t0)
      let isLinear = true

      for (let j = 0; j < valueSize; j++) {
        const interpolated = v0[j] + (v2[j] - v0[j]) * alpha
        if (Math.abs(interpolated - v1[j]) > tolerance) {
          isLinear = false
          break
        }
      }

      if (!isLinear) {
        optimizedTimes.push(t1)
        optimizedValues.push(...v1)
      }
    }

    optimizedTimes.push(times[times.length - 1])
    optimizedValues.push(...values.slice((times.length - 1) * valueSize))

    return this.createTrackFromArrays(
      track.name,
      optimizedTimes,
      optimizedValues,
      track.ValueTypeName as string,
      track.getInterpolation()
    )
  }

  /**
   * 缩放时间轴
   */
  static scaleTime(track: THREE.KeyframeTrack, scale: number): THREE.KeyframeTrack {
    const times = Array.from(track.times).map((t) => t * scale)

    return this.createTrackFromArrays(
      track.name,
      times,
      Array.from(track.values),
      track.ValueTypeName as string,
      track.getInterpolation()
    )
  }

  /**
   * 偏移时间轴
   */
  static offsetTime(track: THREE.KeyframeTrack, offset: number): THREE.KeyframeTrack {
    const times = Array.from(track.times).map((t) => t + offset)

    return this.createTrackFromArrays(
      track.name,
      times,
      Array.from(track.values),
      track.ValueTypeName as string,
      track.getInterpolation()
    )
  }

  /**
   * 裁剪轨道到指定时间范围
   */
  static trim(track: THREE.KeyframeTrack, startTime: number, endTime: number): THREE.KeyframeTrack {
    const times = Array.from(track.times)
    const values = Array.from(track.values)
    const valueSize = track.getValueSize()

    const trimmedTimes: number[] = []
    const trimmedValues: number[] = []

    for (let i = 0; i < times.length; i++) {
      const time = times[i]

      if (time >= startTime && time <= endTime) {
        trimmedTimes.push(time - startTime)
        trimmedValues.push(...values.slice(i * valueSize, (i + 1) * valueSize))
      }
    }

    return this.createTrackFromArrays(
      track.name,
      trimmedTimes,
      trimmedValues,
      track.ValueTypeName as string,
      track.getInterpolation()
    )
  }
}
